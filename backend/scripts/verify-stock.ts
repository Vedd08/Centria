import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const medicines = await prisma.medicine.findMany({
    include: {
      batches: true,
      stockMovements: true,
    }
  });

  let violations = 0;

  for (const m of medicines) {
    const sumBatches = m.batches.reduce((sum, b) => sum + b.currentQty, 0);
    const sumMovements = m.stockMovements.reduce((sum, sm) => sum + sm.delta, 0);

    let hasError = false;
    let errors = [];

    if (m.stockQty !== sumBatches) {
      hasError = true;
      errors.push(`stockQty (${m.stockQty}) != sum(batch.currentQty) (${sumBatches})`);
    }

    if (m.stockQty !== sumMovements) {
      hasError = true;
      errors.push(`stockQty (${m.stockQty}) != sum(stockMovement.delta) (${sumMovements})`);
    }

    if (m.stockQty < 0) {
      hasError = true;
      errors.push(`stockQty (${m.stockQty}) < 0`);
    }

    for (const b of m.batches) {
      if (b.currentQty < 0) {
        hasError = true;
        errors.push(`Batch ${b.id} currentQty (${b.currentQty}) < 0`);
      }
      if (b.currentQty > b.originalQty) {
        hasError = true;
        errors.push(`Batch ${b.id} currentQty (${b.currentQty}) > originalQty (${b.originalQty})`);
      }
    }

    if (hasError) {
      violations++;
      console.error(`Medicine ${m.id} (${m.name}):`);
      for (const e of errors) {
        console.error(`  - ${e}`);
      }
    }
  }

  if (violations > 0) {
    console.error(`\nFound ${violations} medicines with stock violations.`);
    process.exit(1);
  } else {
    console.log('0 violations found. Stock ledger is perfectly consistent.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
