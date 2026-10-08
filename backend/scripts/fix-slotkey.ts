import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function buildSlotKey(doctorId: string, startTime: Date): string {
  return `${doctorId}|${startTime.toISOString()}`;
}

async function main() {
  const appointments = await prisma.appointment.findMany({
    where: { slotKey: null },
  });

  let updated = 0;
  for (const appt of appointments) {
    const slotKey = buildSlotKey(appt.doctorId, new Date(appt.startTime));
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { slotKey },
    });
    updated++;
  }

  console.log(`Updated ${updated} appointments to add slotKey`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
