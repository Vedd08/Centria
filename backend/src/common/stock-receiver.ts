import { BadRequestException, NotFoundException } from '@nestjs/common';

export async function receiveStock(clinicId: string, dto: any, user: any, tx: any) {
  if (!dto.items || dto.items.length === 0) {
    throw new BadRequestException('A medicine-stock bill must list what arrived. Record it under Pharmacy → Stock Refill.');
  }

  // 1. Create the Purchase record if not linking to an existing one
  let purchaseId = dto.purchaseId;
  if (!purchaseId) {
    const purchase = await tx.purchase.create({
      data: {
        clinicId,
        vendorName: dto.vendorName.trim(),
        vendorGstn: (dto.vendorGstn || '').trim().toUpperCase(),
        invoiceNumber: dto.invoiceNumber.trim(),
        invoiceDate: dto.invoiceDate,
        itemDescription: (dto.itemDescription || 'Pharmacy Stock Refill').trim(),
        inputClassification: dto.inputClassification || 'Medicine Stock',
        itcEligibility: dto.itcEligibility || 'Full',
        taxableValue: dto.taxableValue !== undefined ? Math.round(dto.taxableValue * 100) / 100 : Math.round(dto.totalValue * 100) / 100,
        igst: dto.igst !== undefined ? Math.round(dto.igst * 100) / 100 : 0,
        cgst: dto.cgst !== undefined ? Math.round(dto.cgst * 100) / 100 : 0,
        sgst: dto.sgst !== undefined ? Math.round(dto.sgst * 100) / 100 : 0,
        totalValue: dto.totalValue !== undefined ? Math.round(dto.totalValue * 100) / 100 : Math.round((dto.taxableValue + (dto.igst || 0) + (dto.cgst || 0) + (dto.sgst || 0)) * 100) / 100,
        recordedById: user?.id || '',
      }
    });
    purchaseId = purchase.id;
  }

  // 2. Process each medicine item
  for (const item of dto.items) {
    const medicine = item.newMedicine
      ? await findOrCreateMedicine(clinicId, item.newMedicine, tx)
      : await tx.medicine.findFirst({ where: { id: item.medicineId, clinicId } });
    if (!medicine) {
      throw new NotFoundException(`Medicine ID ${item.medicineId} not found`);
    }
    item.medicineId = medicine.id;

    // Put-away: record which rack this stock went on.
    const shelf = typeof item.shelf === 'string' ? item.shelf.trim() : '';
    if (shelf && shelf !== medicine.shelf) {
      await tx.medicine.update({ where: { id: medicine.id }, data: { shelf } });
    }

    // Add Batch
    await tx.medicineBatch.create({
      data: {
        medicineId: item.medicineId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate || null,
        originalQty: item.quantity,
        currentQty: item.quantity,
        costPrice: item.costPrice,
        purchaseId: purchaseId
      }
    });

    // Update Stock
    await tx.medicine.update({
      where: { id: item.medicineId },
      data: { stockQty: { increment: item.quantity } }
    });

    const updated = await tx.medicine.findUniqueOrThrow({ where: { id: item.medicineId } });

    // Log Stock Movement
    await tx.stockMovement.create({
      data: {
        clinicId,
        medicineId: item.medicineId,
        delta: item.quantity,
        reason: `Wholesaler Refill (Batch: ${item.batchNumber})`,
        newQty: updated.stockQty,
        performedById: user?.id || null
      }
    });
  }

  return { id: purchaseId };
}

/**
 * A refill line for a medicine not yet in the catalogue. Names are unique per clinic,
 * so a name that already exists (say, typed twice or added since the page loaded)
 * reuses that medicine instead of failing the whole bill.
 */
async function findOrCreateMedicine(
  clinicId: string,
  input: { name: string; unit: string; unitPrice?: number; reorderPoint?: number },
  tx: any,
) {
  const name = input.name.trim();
  const existing = await tx.medicine.findFirst({ where: { clinicId, name } });
  if (existing) return existing;

  return tx.medicine.create({
    data: {
      clinicId,
      name,
      unit: input.unit.trim(),
      unitPrice: input.unitPrice ?? 0,
      reorderPoint: input.reorderPoint ?? 10,
      stockQty: 0, // The refill below books the arriving quantity.
    },
  });
}
