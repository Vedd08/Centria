import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { decrementStock } from '../common/decrement-stock';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CreateMedicationOrderDto } from './dto/create-medication-order.dto';
import { DiscontinueMedicationOrderDto } from './dto/discontinue-medication-order.dto';
import { MarkAdministeredDto } from './dto/mark-administered.dto';

/** Roles that may be recorded as the prescribing doctor on a medication order. */
const DOCTOR_ROLES = ['DOCTOR', 'MASTER', 'SUPER_ADMIN'];

const ORDER_INCLUDE = {
  medicine: true,
  doctor: { select: { id: true, name: true, role: true } },
} as const;

@Injectable()
export class MedicationOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreateMedicationOrderDto, requestingUser: any) {
    const admission = await this.prisma.admission.findFirst({ where: { id: dto.admissionId, clinicId } });
    if (!admission) {
      throw new NotFoundException(`Admission ID ${dto.admissionId} not found`);
    }
    if (admission.status !== 'ADMITTED') {
      throw new BadRequestException('Cannot add a medication order to a discharged admission');
    }

    const medicine = await this.prisma.medicine.findFirst({ where: { id: dto.medicineId, clinicId } });
    if (!medicine) {
      throw new NotFoundException(`Medicine ID ${dto.medicineId} not found`);
    }
    if (!medicine.isActive) {
      throw new BadRequestException(`Medicine '${medicine.name}' is discontinued and cannot be ordered`);
    }

    const doctorId = dto.doctorId ?? requestingUser.id;
    const doctor = await this.prisma.user.findFirst({ where: { id: doctorId, clinicId } });
    if (!doctor || !DOCTOR_ROLES.includes(doctor.role)) {
      throw new BadRequestException(`Invalid Doctor User ID ${doctorId}`);
    }

    return this.prisma.medicationOrder.create({
      data: {
        clinicId,
        admissionId: admission.id,
        patientId: admission.patientId,
        medicineId: medicine.id,
        doctorId: doctor.id,
        dosage: dto.dosage,
        route: dto.route,
        frequency: dto.frequency,
        instructions: dto.instructions,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: 'ACTIVE',
      },
      include: ORDER_INCLUDE,
    });
  }

  async findAll(clinicId: string, admissionId: string) {
    return this.prisma.medicationOrder.findMany({
      where: { admissionId, clinicId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOne(clinicId: string, id: string) {
    const order = await this.prisma.medicationOrder.findFirst({ where: { id, clinicId }, include: ORDER_INCLUDE });
    if (!order) {
      throw new NotFoundException(`Medication order ID ${id} not found`);
    }
    return order;
  }

  async discontinue(clinicId: string, id: string, dto: DiscontinueMedicationOrderDto) {
    const order = await this.findOne(clinicId, id);
    if (order.status !== 'ACTIVE') {
      throw new ConflictException('This medication order is not active');
    }
    return this.prisma.medicationOrder.update({
      where: { id },
      data: { status: 'DISCONTINUED', discontinuedReason: dto.discontinuedReason },
      include: ORDER_INCLUDE,
    });
  }

  async markAdministered(clinicId: string, orderId: string, dto: MarkAdministeredDto, requestingUser: any) {
    const order = await this.findOne(clinicId, orderId);
    if (order.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot record administration for a discontinued medication order');
    }

    return this.prisma.$transaction(async (tx) => {
      // A dose that actually reached the patient came out of ward stock. Missed and
      // refused doses never left the trolley, so they move nothing.
      if (dto.status === 'Given' && order.medicineId) {
        const medicine = await tx.medicine.findFirst({ where: { id: order.medicineId, clinicId } });
        if (!medicine) throw new NotFoundException('Medicine no longer exists');

        const { newQty } = await decrementStock(tx, clinicId, medicine, 1);
        await tx.stockMovement.create({
          data: {
            clinicId,
            medicineId: medicine.id,
            delta: -1,
            reason: `Ward dose given (${order.medicine?.name ?? medicine.name})`,
            newQty,
            performedById: requestingUser.id,
          },
        });
      }

      return tx.medicationAdministration.create({
        data: {
          clinicId,
          medicationOrderId: order.id,
          status: dto.status,
          notes: dto.notes,
          // Always the requester — a MAR entry is a personal attestation of who gave the
          // dose and must not be reassignable to someone else.
          administeredById: requestingUser.id,
        },
        include: { administeredBy: { select: { id: true, name: true, role: true } } },
      });
    }, TRANSACTION_OPTIONS);
  }

  async getAdministrations(clinicId: string, orderId: string) {
    await this.findOne(clinicId, orderId); // Ensure existence and clinic ownership
    return this.prisma.medicationAdministration.findMany({
      where: { medicationOrderId: orderId, clinicId },
      include: { administeredBy: { select: { id: true, name: true, role: true } } },
      orderBy: { administeredAt: 'desc' },
    });
  }
}
