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

  let mismatches = 0;
  for (const app of appointments) {
    const expected = service.buildSlotKey(app.doctorId, app.startTime);
    if (app.slotKey !== expected) {
      mismatches++;
    }
  }

  console.log(`Found ${mismatches} mismatches.`);
  if (mismatches > 0) process.exit(1);
}

main().finally(async () => await prisma.$disconnect());
