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

  // 2. FIFO Batch deduction
  let remainingToDeduct = quantity;
  const batchDeductions: BatchDeduction[] = [];

  // Get all batches with available qty
  const availableBatches = await tx.medicineBatch.findMany({
    where: { medicineId: medicine.id, currentQty: { gt: 0 } },
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

  if (remainingToDeduct > 0) {
    throw new Error(`Invariant violation: stockQty allowed deduction of ${quantity}, but batches fell short by ${remainingToDeduct}. Ledger is inconsistent.`);
  }

  return { newQty: updated.stockQty, batchDeductions };
}
