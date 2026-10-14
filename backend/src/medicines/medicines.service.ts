import { toLocalDateKey } from '../common/date.helper';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { receiveStock } from '../common/stock-receiver';
import { deductFromBatches } from '../common/decrement-stock';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RefillStockDto } from './dto/refill-stock.dto';
import { textContains } from '../common/text-search';

@Injectable()
export class MedicinesService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreateMedicineDto, requestingUser?: any) {
    const name = dto.name.trim();
    const stockQty = dto.stockQty ?? 0;

    return this.prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.create({
        data: {
          clinicId,
          name,
          unit: dto.unit.trim(),
          stockQty,
          reorderPoint: dto.reorderPoint ?? 10,
          unitPrice: dto.unitPrice ?? 0,
          isActive: dto.isActive ?? true,
          isGstTaxable: dto.isGstTaxable ?? false,
          ...(dto.shelf !== undefined ? { shelf: dto.shelf.trim() } : {}),
          ...(dto.hsnCode !== undefined ? { hsnCode: dto.hsnCode.trim() } : {}),
          ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate } : {}),
        },
      });

      // Book the opening quantity into the ledger too, otherwise the movement
      // history starts mid-story and never adds up to the balance on screen —
      // the first thing anyone checks when stock looks wrong.
      if (stockQty > 0) {
        await tx.stockMovement.create({
          data: {
            clinicId,
            medicineId: medicine.id,
            delta: stockQty,
            reason: 'Opening stock',
            newQty: stockQty,
            performedById: requestingUser?.id ?? null,
          },
        });
      }

      return medicine;
    }, TRANSACTION_OPTIONS);
  }

  async findAll(clinicId: string, search?: string, lowStockOnly?: boolean) {
    const term = search?.trim();
    const medicines = await this.prisma.medicine.findMany({
      where: {
        clinicId,
        ...(term ? { name: textContains(term) } : {}),
      },
      orderBy: { name: 'asc' },
    });

    if (!lowStockOnly) {
      return medicines;
    }

    // Prisma cannot compare two columns in a `where`, so the reorder-point check
    // happens here rather than in the query.
    return medicines.filter((m) => m.stockQty <= m.reorderPoint);
  }

  async findOne(clinicId: string, id: string) {
    const medicine = await this.prisma.medicine.findFirst({ where: { id, clinicId } });
    if (!medicine) {
      throw new NotFoundException(`Medicine ID ${id} not found`);
    }
    return medicine;
  }

  async update(clinicId: string, id: string, dto: UpdateMedicineDto) {
    await this.findOne(clinicId, id); // Ensure existence and ownership
    return this.prisma.medicine.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
        ...(dto.stockQty !== undefined ? { stockQty: dto.stockQty } : {}),
        ...(dto.reorderPoint !== undefined ? { reorderPoint: dto.reorderPoint } : {}),
        ...(dto.unitPrice !== undefined ? { unitPrice: dto.unitPrice } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isGstTaxable !== undefined ? { isGstTaxable: dto.isGstTaxable } : {}),
        ...(dto.shelf !== undefined ? { shelf: dto.shelf.trim() } : {}),
        ...(dto.hsnCode !== undefined ? { hsnCode: dto.hsnCode.trim() } : {}),
        ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate } : {}),
      },
    });
  }

  /**
   * Applies a signed stock delta atomically. Rejects adjustments that would drive the
   * balance below zero, so a goods-return entry cannot produce negative inventory.
   * Records a StockMovement entry for audit trail purposes.
   */
  async adjustStock(clinicId: string, id: string, dto: AdjustStockDto, requestingUser?: any) {
    return this.prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.findFirst({ where: { id, clinicId } });
      if (!medicine) {
        throw new NotFoundException(`Medicine ID ${id} not found`);
      }

      // Apply the delta as a conditional increment so the guard and the write are one
      // statement — a read-then-write here would let two simultaneous adjustments each
      // compute from the same starting balance and silently drop one of them.
      const claim = await tx.medicine.updateMany({
        where: {
          id,
          clinicId,
          // Only a stock-out needs a floor; receiving stock can never go negative.
          ...(dto.delta < 0 ? { stockQty: { gte: -dto.delta } } : {}),
        },
        data: { stockQty: { increment: dto.delta } },
      });

      if (claim.count === 0) {
        const current = await tx.medicine.findFirst({ where: { id, clinicId }, select: { stockQty: true } });
        const balance = current?.stockQty ?? 0;
        throw new BadRequestException(
          `Adjustment of ${dto.delta} would leave '${medicine.name}' at ${balance + dto.delta} units. Stock cannot go negative (currently ${balance}).`,
        );
      }

      const { stockQty: newQty } = await tx.medicine.findFirstOrThrow({
        where: { id, clinicId },
        select: { stockQty: true },
      });

      // A stock-out (write-off, return, count correction) leaves the batches too, so
      // batch totals never claim more than is on the shelf.
      if (dto.delta < 0) await deductFromBatches(tx, id, -dto.delta);

      // Record stock movement for audit trail
      await tx.stockMovement.create({
        data: {
          clinicId,
          medicineId: id,
          delta: dto.delta,
          reason: dto.reason || (dto.delta > 0 ? 'Manual stock-in' : 'Manual stock-out'),
          newQty,
          performedById: requestingUser?.id || null,
        },
      });

      return tx.medicine.findUnique({ where: { id } });
    }, TRANSACTION_OPTIONS);
  }

  /**
   * Returns the stock movement history for a given medicine.
   */
  async getStockMovements(clinicId: string, medicineId: string) {
    // Note: The medicine itself is verified implicitly or explicitly, but it's safe to query stockMovement directly using clinicId
    return this.prisma.stockMovement.findMany({
      where: { medicineId, clinicId },
      include: {
        performedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Process a wholesaler refill, updating stock, creating batches, and logging to accounts.
   */
  async refillStock(clinicId: string, dto: RefillStockDto, requestingUser?: any) {
    return this.prisma.$transaction(async (tx) => {
      return receiveStock(clinicId, dto, requestingUser, tx);
    }, TRANSACTION_OPTIONS);
  }

  /**
   * Get batches expiring within the specified number of days (default 90).
   */
  async getExpiringBatches(clinicId: string, daysAhead: number) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    const targetDateStr = toLocalDateKey(targetDate);

    return this.prisma.medicineBatch.findMany({
      where: {
        medicine: { clinicId },
        currentQty: { gt: 0 },
        OR: [ { expiryDate: { lte: targetDateStr } }, { expiryDate: null } ]
      },
      include: {
        medicine: { select: { id: true, name: true, unit: true, shelf: true } },
        purchase: { select: { id: true, vendorName: true, invoiceNumber: true, invoiceDate: true } }
      },
      orderBy: { expiryDate: 'asc' }
    });
  }

  /**
   * Get full traceability for a batch.
   */
  async getBatchTraceability(clinicId: string, batchId: string) {
    return this.prisma.medicineBatch.findFirst({
      where: { id: batchId, medicine: { clinicId } },
      include: {
        medicine: true,
        purchase: {
          include: { recordedBy: { select: { name: true } } }
        },
        dispenseRecords: {
          include: {
            retailSaleItem: {
              include: { retailSale: true }
            },
            careOrder: {
              include: { 
                queue: { include: { patient: true } },
                orderedBy: { select: { name: true } }
              }
            }
          }
        }
      }
    });
  }
}
