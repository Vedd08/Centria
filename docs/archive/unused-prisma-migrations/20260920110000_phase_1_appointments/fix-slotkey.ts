import { PrismaClient } from '@prisma/client';
import { AppointmentsService } from '../../../src/appointments/appointments.service';

const prisma = new PrismaClient();
const service = new AppointmentsService(prisma as any);

async function main() {
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { notIn: ['Cancelled', 'No-Show'] }
    }
  });

  console.log(`Found ${appointments.length} appointments to update.`);

  let updatedCount = 0;
  for (const app of appointments) {
    const slotKey = service.buildSlotKey(app.doctorId, app.startTime);
    if (app.slotKey !== slotKey) {
      await prisma.appointment.update({
        where: { id: app.id },
        data: { slotKey }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} appointments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
