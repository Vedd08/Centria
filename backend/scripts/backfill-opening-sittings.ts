import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const purchases = await prisma.packagePurchase.findMany({
    include: {
      visits: true,
    },
  });

  let updated = 0;
  for (const p of purchases) {
    const linkedVisitsCount = p.visits.length;
    const requiredOpening = Math.max(0, p.sittingsUsed - linkedVisitsCount);
    
    if (p.openingSittingsUsed !== requiredOpening) {
      await prisma.packagePurchase.update({
        where: { id: p.id },
        data: { openingSittingsUsed: requiredOpening },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} purchases to sync openingSittingsUsed`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
