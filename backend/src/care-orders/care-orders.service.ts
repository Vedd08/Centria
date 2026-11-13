import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decrementStock } from '../common/decrement-stock';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CreateCareOrderDto } from './dto/create-care-order.dto';
import { PerformCareOrderDto } from './dto/perform-care-order.dto';

/** Order types the pharmacy dispenses against physical stock. */
const STOCK_BACKED = ['MEDICINE', 'INJECTION'];


const ORDER_INCLUDE = {
  medicine: true,
  treatment: true,
  patient: true,
  queue: { select: { id: true, tokenNumber: true, queueDate: true, careType: true, status: true } },
  orderedBy: { select: { id: true, name: true, role: true } },
  performedBy: { select: { id: true, name: true, role: true } },
  dispensedBy: { select: { id: true, name: true, role: true } },
} as const;

@Injectable()
export class CareOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreateCareOrderDto, requestingUser: any) {
    const queue = await this.prisma.patientQueue.findFirst({ where: { id: dto.queueId, clinicId } });
    if (!queue) {
      throw new NotFoundException(`Queue entry ${dto.queueId} not found`);
    }
    if (queue.status === 'CANCELLED' || queue.status === 'COMPLETED') {
      throw new BadRequestException('This patient encounter is already closed');
    }

    let medicine: { id: string; name: string; unitPrice: any; isActive: boolean } | null = null;
    if (STOCK_BACKED.includes(dto.orderType)) {
      if (!dto.medicineId) {
        if (!dto.notStocked) {
          throw new BadRequestException(`A ${dto.orderType.toLowerCase()} order must reference a pharmacy item`);
        }
      } else {
        medicine = await this.prisma.medicine.findFirst({ where: { id: dto.medicineId, clinicId } });
        if (!medicine) {
          throw new NotFoundException(`Medicine ID ${dto.medicineId} not found`);
        }
        if (!medicine.isActive) {
          throw new BadRequestException(`'${medicine.name}' is discontinued and cannot be ordered`);
        }
      }
    }

    let treatment: { id: string; name: string; price: any } | null = null;
    if (dto.treatmentId) {
      treatment = await this.prisma.treatmentMaster.findFirst({ where: { id: dto.treatmentId, clinicId } });
      if (!treatment) {
        throw new NotFoundException(`Treatment ID ${dto.treatmentId} not found`);
      }
    }

    const description = dto.description?.trim() || medicine?.name || treatment?.name;
    if (!description) {
      throw new BadRequestException('Describe what should be done for this patient');
    }

    const quantity = dto.quantity ?? 1;
    const unitPrice = Number(medicine?.unitPrice ?? treatment?.price ?? 0);

    return this.prisma.careOrder.create({
      data: {
        clinicId,
        queueId: queue.id,
        patientId: queue.patientId,
        orderType: dto.orderType,
        medicineId: medicine?.id ?? null,
        treatmentId: treatment?.id ?? null,
        description,
        dosage: dto.dosage,
        route: dto.route,
        frequency: dto.frequency,
        instructions: dto.instructions,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        status: 'ORDERED',
        orderedById: requestingUser.id,
      },
      include: ORDER_INCLUDE,
    });
  }

  async findAll(
    clinicId: string,
    filters: { queueId?: string; patientId?: string; status?: string; date?: string; pendingDispense?: boolean } = {},
    requestingUser?: any,
  ) {
    const where: Prisma.CareOrderWhereInput = { clinicId };
    if (filters.queueId) where.queueId = filters.queueId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = { in: filters.status.split(',').map((s) => s.trim()) };
    if (filters.date) where.queue = { queueDate: filters.date };

    // Nurse / Staff is one role covering both OPD and IPD, so worklists are not
    // narrowed by role.
    if (filters.pendingDispense) {
      // The pharmacy worklist: stock-backed items not yet handed over.
      where.orderType = { in: STOCK_BACKED };
      where.medicineId = { not: null };
      where.dispensedAt = null;
      where.status = { not: 'CANCELLED' };
    }

    return this.prisma.careOrder.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOneOrThrow(clinicId: string, id: string) {
    const order = await this.prisma.careOrder.findFirst({ where: { id, clinicId }, include: ORDER_INCLUDE });
    if (!order) {
      throw new NotFoundException(`Care order ${id} not found`);
    }
    return order;
  }

  /** Staff/nurse records that they carried the order out. */
  async perform(clinicId: string, id: string, dto: PerformCareOrderDto, requestingUser: any) {
    const order = await this.findOneOrThrow(clinicId, id);
    if (order.status === 'CANCELLED') {
      throw new ConflictException('This order was cancelled');
    }
    if (order.status === 'DONE') {
      throw new ConflictException('This order is already marked done');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.careOrder.update({
        where: { id },
        data: {
          status: 'DONE',
          // Always the requester — this is a personal attestation of who did the work.
          performedById: requestingUser.id,
          performedAt: new Date(),
          performNotes: dto.performNotes,
        },
        include: ORDER_INCLUDE,
      });

      // Move the encounter along the moment the first order is actioned.
      if (order.queue && ['AWAITING_SERVICE', 'WITH_DOCTOR'].includes(order.queue.status)) {
        await tx.patientQueue.update({ where: { id: order.queueId }, data: { status: 'IN_SERVICE' } });
      }

      return updated;
    }, TRANSACTION_OPTIONS);
  }

  async untag(clinicId: string, id: string, templateName: string) {
    if (!templateName) throw new BadRequestException('templateName is required');
    const order = await this.findOneOrThrow(clinicId, id);
    if (!order.sourceTemplates) return order;

    const names = order.sourceTemplates.split(' | ').filter(n => n !== templateName);
    const newTemplates = names.length > 0 ? names.join(' | ') : null;

    return this.prisma.careOrder.update({
      where: { id },
      data: { sourceTemplates: newTemplates },
      include: ORDER_INCLUDE,
    });
  }

  /**
   * Cancels an order at any stage. If the pharmacy already dispensed it, the
   * medicine goes back into stock — to the same batches it was taken from — and
   * the return is logged, so stock never drifts from what is on the shelf.
   * A cancelled order drops out of the patient's charges.
   */
  async cancel(clinicId: string, id: string, requestingUser: any) {
    const order = await this.findOneOrThrow(clinicId, id);
    if (order.status === 'CANCELLED') {
      throw new ConflictException('This order is already cancelled');
    }

    if (!order.dispensedAt || !order.medicineId) {
      return this.prisma.careOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: ORDER_INCLUDE,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so two clicks can't return the stock twice.
      const claimed = await tx.careOrder.updateMany({
        where: { id, clinicId, status: { not: 'CANCELLED' }, dispensedAt: { not: null } },
        data: { status: 'CANCELLED', dispensedAt: null, dispensedById: null },
      });
      if (claimed.count === 0) {
        throw new ConflictException('This order was already cancelled');
      }

      const batchRecords = await tx.batchDispenseRecord.findMany({ where: { careOrderId: id } });
      for (const rec of batchRecords) {
        await tx.medicineBatch.update({
          where: { id: rec.batchId },
          data: { currentQty: { increment: rec.quantity } },
        });
      }
      await tx.batchDispenseRecord.deleteMany({ where: { careOrderId: id } });

      const medicine = await tx.medicine.update({
        where: { id: order.medicineId! },
        data: { stockQty: { increment: order.quantity } },
        select: { stockQty: true },
      });

      await tx.stockMovement.create({
        data: {
          clinicId,
          medicineId: order.medicineId!,
          delta: order.quantity,
          reason: `Cancelled care order — returned to stock (${order.description})`,
          newQty: medicine.stockQty,
          performedById: requestingUser.id,
        },
      });

      return tx.careOrder.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    }, TRANSACTION_OPTIONS);
  }

  async delete(clinicId: string, id: string) {
    const order = await this.findOneOrThrow(clinicId, id);
    if (order.status !== 'ORDERED' || order.dispensedAt || order.performedAt) {
      throw new BadRequestException('Cannot delete an order that has already been performed or dispensed. Use cancellation instead.');
    }
    await this.prisma.careOrder.delete({
      where: { id },
    });
    return { id, deleted: true };
  }

  /**
   * Pharmacy hand-over. Deducts the ordered quantity from stock and records the
   * movement, in one transaction so stock can never drift from the ledger.
   */
  async dispense(clinicId: string, id: string, requestingUser: any) {
    const order = await this.findOneOrThrow(clinicId, id);

    if (!STOCK_BACKED.includes(order.orderType) || !order.medicineId) {
      throw new BadRequestException('Only medicine and injection orders from the pharmacy catalogue can be dispensed');
    }
    if (order.status === 'CANCELLED') {
      throw new ConflictException('This order was cancelled');
    }
    if (order.dispensedAt) {
      throw new ConflictException('This order has already been dispensed');
    }

    return this.prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.findFirst({ where: { id: order.medicineId!, clinicId } });
      if (!medicine) {
        throw new NotFoundException('Medicine no longer exists');
      }

      // Claim the stock with a conditional decrement rather than reading the balance
      // and writing back what we computed: two counters dispensing the same medicine
      // at once would both read the old figure and one deduction would vanish.
      const { newQty, batchDeductions } = await decrementStock(tx, clinicId, medicine, order.quantity);

      await tx.stockMovement.create({
        data: {
          clinicId,
          medicineId: medicine.id,
          delta: -order.quantity,
          reason: `Care order dispense (${order.description})`,
          newQty,
          performedById: requestingUser.id,
        },
      });

      if (batchDeductions && batchDeductions.length > 0) {
        await tx.batchDispenseRecord.createMany({
          data: batchDeductions.map(bd => ({
            batchId: bd.batchId,
            quantity: bd.quantity,
            careOrderId: order.id,
          })),
        });
      }

      return tx.careOrder.update({
        where: { id },
        data: { dispensedAt: new Date(), dispensedById: requestingUser.id },
        include: ORDER_INCLUDE,
      });
    }, TRANSACTION_OPTIONS);
  }

  /**
   * What the pharmacy counter needs to collect for a patient's encounter:
   * the stock-backed items and what they add up to.
   */
  async getQueueCharges(clinicId: string, queueId: string) {
    const orders = await this.prisma.careOrder.findMany({
      where: { clinicId, queueId, status: { not: 'CANCELLED' } },
      include: ORDER_INCLUDE,
    });

    const pharmacyItems = orders.filter((o) => STOCK_BACKED.includes(o.orderType) && o.medicineId);
    const otherItems = orders.filter((o) => !STOCK_BACKED.includes(o.orderType) || !o.medicineId);
    const sum = (rows: typeof orders) => rows.reduce((acc, o) => acc + Number(o.totalPrice), 0);

    return {
      pharmacyItems,
      otherItems,
      pharmacyTotal: sum(pharmacyItems),
      otherTotal: sum(otherItems),
      grandTotal: sum(orders),
      allDispensed: pharmacyItems.every((o) => o.dispensedAt),
    };
  }

  /**
   * Detailed breakdown for printing a standalone Pharmacy Invoice, complete with GST calculations.
   */
  async getPharmacyBill(clinicId: string, queueId: string) {
    const queue = await this.prisma.patientQueue.findFirst({
      where: { id: queueId, clinicId },
      include: { patient: true, doctor: true },
    });
    if (!queue) throw new NotFoundException('Queue entry not found');

    const orders = await this.prisma.careOrder.findMany({
      where: { clinicId, queueId, status: { not: 'CANCELLED' }, orderType: { in: STOCK_BACKED } },
      include: ORDER_INCLUDE,
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const lines = orders.map(order => ({
      description: order.description,
      kind: order.orderType,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      amount: Number(order.totalPrice),
      taxable: order.medicine?.isGstTaxable ?? false,
      hsnCode: order.medicine?.hsnCode ?? undefined,
      taxRate: order.medicine?.taxRate ? Number(order.medicine.taxRate) : undefined,
    }));

    const subTotal = round2(lines.reduce((acc, l) => acc + l.amount, 0));
    const taxableValue = round2(lines.filter(l => l.taxable).reduce((acc, l) => acc + l.amount, 0));
    const exemptValue = round2(subTotal - taxableValue);

    let totalCgst = 0;
    let totalSgst = 0;
    for (const l of lines) {
      if (l.taxable) {
        const rate = l.taxRate ?? 18;
        totalCgst += l.amount * ((rate / 2) / 100);
        totalSgst += l.amount * ((rate / 2) / 100);
      }
    }

    const cgst = round2(totalCgst);
    const sgst = round2(totalSgst);

    return {
      queueId: queue.id,
      tokenNumber: queue.tokenNumber,
      queueDate: queue.queueDate,
      careType: queue.careType,
      patient: queue.patient,
      doctor: queue.doctor,
      lines,
      subTotal,
      taxableValue,
      exemptValue,
      cgst,
      sgst,
      totalAmount: round2(subTotal + cgst + sgst),
    };
  }
}
