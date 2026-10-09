import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const medicines = await prisma.medicine.findMany({
    include: {
      batches: true,
      stockMovements: true,
    }
  });

  for (const m of medicines) {
    const sumBatches = m.batches.reduce((sum, b) => sum + b.currentQty, 0);
    const sumMovements = m.stockMovements.reduce((sum, sm) => sum + sm.delta, 0);

    // Goal 3: 10 medicines with untracked stock
    // (If they have stock but no batch, or sumBatches != stockQty and they have NO batches at all?)
    // The prompt: "10 of 26 medicines have stock but no batch at all... Add an openingBatch for each of the 10"
    if (m.stockQty > 0 && m.batches.length === 0) {
      console.log(`Adding OPENING batch for ${m.name}`);
      await prisma.medicineBatch.create({
        data: {
          medicineId: m.id,
          batchNumber: 'OPENING',
          expiryDate: null,
          originalQty: m.stockQty,
          currentQty: m.stockQty,
          costPrice: 0,
          purchaseId: null,
        }
      });
    }

    // Goal 4: 8 unexplained balances
    // "For each, write one StockMovement with delta = the shortfall, newQty = the current stockQty, and reason: 'Opening balance (recorded before stock ledger)'."
    if (m.stockQty !== sumMovements) {
      const shortfall = m.stockQty - sumMovements;
      console.log(`Writing shortfall StockMovement of ${shortfall} for ${m.name}`);
      await prisma.stockMovement.create({
        data: {
          clinicId: m.clinicId,
          medicineId: m.id,
          delta: shortfall,
          reason: 'Opening balance (recorded before stock ledger)',
          newQty: m.stockQty,
          // performedById not strictly required or use a known one if nullable. It is nullable.
        }
      });
    }
  }

  console.log('Done');
}

main().catch(console.error).finally(() => prisma.$disconnect());
