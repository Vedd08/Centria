import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { decrementStock } from '../common/decrement-stock';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

/** Roles that may be recorded as the prescribing doctor. */
const PRESCRIBER_ROLES = ['DOCTOR', 'MASTER', 'SUPER_ADMIN'];

const PRESCRIPTION_INCLUDE = {
  patient: true,
  visit: { include: { treatment: true } },
  doctor: { select: { id: true, name: true, email: true, role: true } },
  dispensedBy: { select: { id: true, name: true, email: true, role: true } },
  items: { include: { medicine: true } },
} as const;

@Injectable()
export class PrescriptionsService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreatePrescriptionDto, requestingUser: any) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: dto.visitId, clinicId },
      include: { patient: true },
    });
    if (!visit) {
      throw new NotFoundException(`Visit ID ${dto.visitId} not found`);
    }

    // Default the prescriber to whoever is signed in; only fall back to an explicit
    // doctorId when an admin records a prescription on a doctor's behalf.
    const doctorId = dto.doctorId ?? requestingUser?.id;
    if (!doctorId) {
      throw new BadRequestException('Prescribing doctor could not be determined');
    }

    const doctor = await this.prisma.user.findFirst({ where: { id: doctorId, clinicId } });
    if (!doctor || !PRESCRIBER_ROLES.includes(doctor.role)) {
      throw new BadRequestException(`User ${doctorId} is not allowed to prescribe`);
    }

    // Validate every medicine up front so a bad line item cannot leave a
    // half-populated prescription behind.
    const medicineIds = dto.items.map((i) => i.medicineId);
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds }, clinicId },
    });
    const medicineMap = new Map(medicines.map((m) => [m.id, m]));

    for (const item of dto.items) {
      const medicine = medicineMap.get(item.medicineId);
      if (!medicine) {
        throw new NotFoundException(`Medicine ID ${item.medicineId} not found`);
      }
      if (!medicine.isActive) {
        throw new BadRequestException(`Medicine '${medicine.name}' is discontinued and cannot be prescribed`);
      }
    }

    const created = await this.prisma.prescription.create({
      data: {
        clinicId,
        visitId: visit.id,
        patientId: visit.patientId,
        doctorId: doctor.id,
        notes: dto.notes,
        status: 'Pending',
        items: {
          create: dto.items.map((item) => ({
            medicineId: item.medicineId,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            quantity: item.quantity,
          })),
        },
      },
      include: PRESCRIPTION_INCLUDE,
    });

    return created;
  }

  async findAll(clinicId: string, filters: { patientId?: string; visitId?: string; status?: string }) {
    return this.prisma.prescription.findMany({
      where: {
        clinicId,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.visitId ? { visitId: filters.visitId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: PRESCRIPTION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, clinicId },
      include: PRESCRIPTION_INCLUDE,
    });
    if (!prescription) {
      throw new NotFoundException(`Prescription ID ${id} not found`);
    }
    return prescription;
  }

  /**
   * Pharmacy fulfilment: flips the prescription to Dispensed and deducts each line
   * item from medicine stock in one transaction, so a shortfall on the last item
   * cannot leave earlier items already deducted.
   */
  async dispense(clinicId: string, id: string, requestingUser: any) {
    return this.prisma.$transaction(
      async (tx) => {
        const prescription = await tx.prescription.findFirst({
          where: { id, clinicId },
          include: { items: { include: { medicine: true } } },
        });

        if (!prescription) {
          throw new NotFoundException(`Prescription ID ${id} not found`);
        }
        if (prescription.status === 'Dispensed') {
          throw new ConflictException('This prescription has already been dispensed');
        }

        for (const item of prescription.items) {
          if (item.medicine.stockQty < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for '${item.medicine.name}': ${item.quantity} ${item.medicine.unit}(s) required, ${item.medicine.stockQty} in stock.`,
            );
          }
        }

        for (const item of prescription.items) {
          // Deducts against the live balance, not the figure read in the check loop
          // above — that copy goes stale the moment the same medicine appears on two
          // lines of one prescription, and the second write would undo the first.
          const { newQty } = await decrementStock(tx, clinicId, item.medicine, item.quantity);

          await tx.stockMovement.create({
            data: {
              clinicId,
              medicineId: item.medicineId,
              delta: -item.quantity,
              reason: `Prescription dispense (Rx ID: ${prescription.id.slice(0, 8)})`,
              newQty,
              performedById: requestingUser?.id ?? null,
            },
          });
        }

        return tx.prescription.update({
          where: { id },
          data: {
            status: 'Dispensed',
            dispensedAt: new Date(),
            dispensedById: requestingUser?.id ?? null,
          },
          include: PRESCRIPTION_INCLUDE,
        });
      },
      TRANSACTION_OPTIONS,
    );
  }

  /**
   * Doctors may withdraw a prescription they wrote, but only while it is still
   * Pending — once the pharmacy has dispensed it, stock has already moved.
   */
  async remove(clinicId: string, id: string, requestingUser: any) {
    const prescription = await this.findOne(clinicId, id);

    if (prescription.status === 'Dispensed') {
      throw new ConflictException(
        'A dispensed prescription cannot be deleted because pharmacy stock has already been deducted',
      );
    }

    if (requestingUser?.role === 'DOCTOR' && prescription.doctorId !== requestingUser.id) {
      throw new ForbiddenException('Doctors can only withdraw their own prescriptions');
    }

    await this.prisma.prescription.delete({ where: { id } });
    return { id, deleted: true };
  }
}
