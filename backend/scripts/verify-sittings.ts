import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const purchases = await prisma.packagePurchase.findMany({
    include: {
      patient: true,
      _count: {
        select: { visits: true }
      }
    }
  });

  let violations = 0;
  
  for (const p of purchases) {
    const visitsCount = p._count.visits;
    
    // Condition 1: sittingsUsed == openingSittingsUsed + linked visits
    if (p.sittingsUsed !== p.openingSittingsUsed + visitsCount) {
      console.error(`VIOLATION (Used logic) on ${p.id}: sittingsUsed (${p.sittingsUsed}) != openingSittingsUsed (${p.openingSittingsUsed}) + linked visits (${visitsCount})`);
      violations++;
    }
    
    // Condition 2: used + remaining == total
    if (p.sittingsUsed + p.sittingsRemaining !== p.totalSittings) {
      console.error(`VIOLATION (Total logic) on ${p.id}: used (${p.sittingsUsed}) + remaining (${p.sittingsRemaining}) != total (${p.totalSittings})`);
      violations++;
    }
  }

  console.log(`\nverify-sittings completed: ${violations} violations found.\n`);

  const snapshot = purchases.map(p => ({
    id: p.id.slice(0, 8),
    name: p.packageName,
    total: p.totalSittings,
    used: p.sittingsUsed,
    remaining: p.sittingsRemaining,
    linkedVisits: p._count.visits,
    openingUsed: p.openingSittingsUsed
  }));

  console.table(snapshot);
}

main().catch(console.error).finally(() => prisma.$disconnect());
