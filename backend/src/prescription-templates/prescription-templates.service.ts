import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CreateTemplateDto, TemplateItemDto } from './dto/create-template.dto';

const TEMPLATE_INCLUDE = {
  items: { include: { medicine: true, treatment: true }, orderBy: { createdAt: 'asc' as const } },
  doctor: { select: { id: true, name: true } },
};

const STOCK_BACKED = ['MEDICINE', 'INJECTION'];

@Injectable()
export class PrescriptionTemplatesService {
  constructor(private prisma: PrismaService) {}

  /** Templates are personal: a doctor only ever sees and edits their own. */
  private async ownedOrThrow(clinicId: string, id: string, user: any) {
    const template = await this.prisma.prescriptionTemplate.findFirst({
      where: { id, clinicId },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    if (template.doctorId !== user.id && !['SUPER_ADMIN', 'MASTER'].includes(user.role)) {
      throw new ForbiddenException('This template belongs to another doctor');
    }
    return template;
  }

  /** Resolves catalogue references so each saved line carries a usable label. */
  private async buildItems(clinicId: string, items: TemplateItemDto[] = []) {
    const rows = [];
    for (const item of items) {
      let label = item.description?.trim();

      if (STOCK_BACKED.includes(item.orderType)) {
        if (!item.medicineId) {
          throw new BadRequestException(`A ${item.orderType.toLowerCase()} line must reference a pharmacy item`);
        }
        const medicine = await this.prisma.medicine.findFirst({ where: { id: item.medicineId, clinicId } });
        if (!medicine) throw new NotFoundException(`Medicine ${item.medicineId} not found`);
        label = label || medicine.name;
      }

      if (item.treatmentId) {
        const treatment = await this.prisma.treatmentMaster.findFirst({ where: { id: item.treatmentId, clinicId } });
        if (!treatment) throw new NotFoundException(`Treatment ${item.treatmentId} not found`);
        label = label || treatment.name;
      }

      if (!label) {
        throw new BadRequestException('Every template line needs a description');
      }

      rows.push({
        orderType: item.orderType,
        medicineId: item.medicineId ?? null,
        treatmentId: item.treatmentId ?? null,
        description: label,
        dosage: item.dosage,
        route: item.route,
        frequency: item.frequency,
        instructions: item.instructions,
        quantity: item.quantity ?? 1,
      });
    }
    return rows;
  }

  async create(clinicId: string, dto: CreateTemplateDto, user: any) {
    const items = await this.buildItems(clinicId, dto.items);
    return this.prisma.prescriptionTemplate.create({
      data: {
        clinicId,
        doctorId: user.id,
        name: dto.name.trim(),
        condition: dto.condition,
        diagnosis: dto.diagnosis,
        patientNotes: dto.patientNotes,
        staffNotes: dto.staffNotes,
        items: { create: items },
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  async findAll(clinicId: string, user: any) {
    // Admins can review the whole library; a doctor sees only their own.
    const scoped = ['SUPER_ADMIN', 'MASTER'].includes(user.role) ? {} : { doctorId: user.id };
    return this.prisma.prescriptionTemplate.findMany({
      where: { clinicId, isActive: true, ...scoped },
      include: TEMPLATE_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(clinicId: string, id: string, user: any) {
    return this.ownedOrThrow(clinicId, id, user);
  }

  async update(clinicId: string, id: string, dto: CreateTemplateDto, user: any) {
    await this.ownedOrThrow(clinicId, id, user);
    const items = await this.buildItems(clinicId, dto.items);

    return this.prisma.$transaction(async (tx) => {
      // Lines have no natural key, so the set is replaced wholesale on save.
      await tx.prescriptionTemplateItem.deleteMany({ where: { templateId: id } });
      return tx.prescriptionTemplate.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          condition: dto.condition,
          diagnosis: dto.diagnosis,
          patientNotes: dto.patientNotes,
          staffNotes: dto.staffNotes,
          items: { create: items },
        },
        include: TEMPLATE_INCLUDE,
      });
    }, TRANSACTION_OPTIONS);
  }

  async remove(clinicId: string, id: string, user: any) {
    await this.ownedOrThrow(clinicId, id, user);
    await this.prisma.prescriptionTemplate.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Drops a template onto a live encounter: copies the wording onto the queue entry
   * and raises a care order per template line, priced from the current catalogue.
   */
  async applyToQueue(clinicId: string, templateId: string, queueId: string, user: any) {
    const template = await this.ownedOrThrow(clinicId, templateId, user);

    const queue = await this.prisma.patientQueue.findFirst({ where: { id: queueId, clinicId } });
    if (!queue) throw new NotFoundException(`Queue entry ${queueId} not found`);
    if (['COMPLETED', 'CANCELLED'].includes(queue.status)) {
      throw new BadRequestException('This patient encounter is already closed');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of template.items) {
        const unitPrice = Number(item.medicine?.unitPrice ?? item.treatment?.price ?? 0);
        await tx.careOrder.create({
          data: {
            clinicId,
            queueId: queue.id,
            patientId: queue.patientId,
            orderType: item.orderType,
            medicineId: item.medicineId,
            treatmentId: item.treatmentId,
            description: item.description,
            dosage: item.dosage,
            route: item.route,
            frequency: item.frequency,
            instructions: item.instructions,
            quantity: item.quantity,
            unitPrice,
            totalPrice: unitPrice * item.quantity,
            status: 'ORDERED',
            orderedById: user.id,
          },
        });
      }

      // Only fill blanks — never overwrite something the doctor already typed.
      return tx.patientQueue.update({
        where: { id: queue.id },
        data: {
          diagnosis: queue.diagnosis || template.diagnosis,
          patientNotes: queue.patientNotes || template.patientNotes,
          staffNotes: queue.staffNotes || template.staffNotes,
        },
        include: {
          patient: true,
          careOrders: { include: { medicine: true } },
        },
      });
    }, TRANSACTION_OPTIONS);
  }
}
