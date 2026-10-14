import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface BatchDeduction {
  batchId: string;
  quantity: number;
}

export async function decrementStock(
  tx: Prisma.TransactionClient,
  clinicId: string,
  medicine: { id: string; name: string; unit: string; stockQty: number },
  quantity: number,
): Promise<{ newQty: number; batchDeductions: BatchDeduction[] }> {
  // 1. Deduct overall medicine stock
  const claim = await tx.medicine.updateMany({
    where: { id: medicine.id, clinicId, stockQty: { gte: quantity } },
    data: { stockQty: { decrement: quantity } },
  });

  if (claim.count === 0) {
    const current = await tx.medicine.findFirst({
      where: { id: medicine.id, clinicId },
      select: { stockQty: true },
    });
    throw new BadRequestException(
      `Insufficient stock for '${medicine.name}': ${quantity} ${medicine.unit}(s) required, ${current?.stockQty ?? 0} in stock.`,
    );
  }

  const updated = await tx.medicine.findFirstOrThrow({
    where: { id: medicine.id, clinicId },
    select: { stockQty: true },
  });

  const batchDeductions = await deductFromBatches(tx, medicine.id, quantity);
  return { newQty: updated.stockQty, batchDeductions };
}

/**
 * Takes `quantity` out of a medicine's batches, earliest expiry first.
 *
 * Not all stock has a batch: opening stock entered with a new medicine and manual
 * "+" adjustments raise stockQty only. stockQty is the source of truth (the caller has
 * already claimed it), so whatever the batches can't cover is taken from that
 * unbatched stock instead of failing the dispense.
 */
export async function deductFromBatches(
  tx: Prisma.TransactionClient,
  medicineId: string,
  quantity: number,
): Promise<BatchDeduction[]> {
  let remainingToDeduct = quantity;
  const batchDeductions: BatchDeduction[] = [];

  // Get all batches with available qty
  const availableBatches = await tx.medicineBatch.findMany({
    where: { medicineId, currentQty: { gt: 0 } },
  });

  // FEFO: known expiries first (earliest first), unknown expiries last
  availableBatches.sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
    if (a.expiryDate && !b.expiryDate) return -1;
    if (!a.expiryDate && b.expiryDate) return 1;
    // Both unknown, fallback to creation time or batch number
    return a.batchNumber.localeCompare(b.batchNumber);
  });

  for (const batch of availableBatches) {
    if (remainingToDeduct <= 0) break;

    const deductQty = Math.min(batch.currentQty, remainingToDeduct);
    
    // Update batch
    await tx.medicineBatch.update({
      where: { id: batch.id },
      data: { currentQty: { decrement: deductQty } }
    });

    batchDeductions.push({
      batchId: batch.id,
      quantity: deductQty,
    });

    remainingToDeduct -= deductQty;
  }

  // Any remainder came from unbatched stock — nothing to trace it to.
  return batchDeductions;
}
