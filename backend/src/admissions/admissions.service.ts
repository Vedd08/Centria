import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { DischargeAdmissionDto } from './dto/discharge-admission.dto';
import { CreateProgressNoteDto } from './dto/create-progress-note.dto';

/** Roles that may be recorded as the attending doctor on an admission. */
const DOCTOR_ROLES = ['DOCTOR', 'MASTER', 'SUPER_ADMIN'];

const ADMISSION_INCLUDE = {
  patient: true,
  bed: { include: { ward: true } },
  doctor: { select: { id: true, name: true, email: true, role: true } },
  admittedBy: { select: { id: true, name: true, email: true, role: true } },
  dischargedBy: { select: { id: true, name: true, email: true, role: true } },
} as const;

@Injectable()
export class AdmissionsService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreateAdmissionDto, requestingUser: any) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${dto.patientId} not found in this clinic`);
    }

    const doctorUser = await this.prisma.user.findFirst({ where: { id: dto.doctorId, clinicId } });
    if (!doctorUser || !DOCTOR_ROLES.includes(doctorUser.role)) {
      throw new BadRequestException(`Invalid Doctor User ID ${dto.doctorId}`);
    }

    let queueEntry: { id: string; admissionId: string | null } | null = null;
    if (dto.queueId) {
      queueEntry = await this.prisma.patientQueue.findFirst({
        where: { id: dto.queueId, clinicId, patientId: patient.id },
        select: { id: true, admissionId: true },
      });
      if (!queueEntry) {
        throw new NotFoundException(`Queue entry ${dto.queueId} not found for this patient`);
      }
      if (queueEntry.admissionId) {
        throw new ConflictException('This queue entry is already linked to an admission');
      }
    }

    const admission = await this.prisma.$transaction(async (tx) => {
      // Atomic compare-and-swap: only claims the bed if it's still AVAILABLE, so two
      // concurrent admit requests can never both win the same bed.
      const claim = await tx.bed.updateMany({
        where: { id: dto.bedId, clinicId, status: 'AVAILABLE', isActive: true },
        data: { status: 'OCCUPIED' },
      });
      if (claim.count === 0) {
        throw new ConflictException(
          'This bed was just assigned to another patient (or is unavailable) — please pick a different bed',
        );
      }

      const created = await tx.admission.create({
        data: {
          clinicId,
          patientId: patient.id,
          doctorId: doctorUser.id,
          bedId: dto.bedId,
          admittedById: requestingUser.id,
          reasonForAdmission: dto.reasonForAdmission,
          admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : new Date(),
          status: 'ADMITTED',
        },
        include: ADMISSION_INCLUDE,
      });

      // Closes the loop back to the doctor's OPD recommendation, if this admission
      // was raised from one — the queue entry's journey ends here, as an admission.
      if (queueEntry) {
        await tx.patientQueue.update({
          where: { id: queueEntry.id },
          data: { admissionId: created.id, status: 'COMPLETED', completedAt: new Date() },
        });
      }

      return created;
    }, TRANSACTION_OPTIONS);

    return admission;
  }

  async findAll(
    clinicId: string,
    filters: { status?: string; patientId?: string; wardId?: string; search?: string } = {},
    page: number = 1,
    pageSize: number = 20,
  ) {
    const where: Prisma.AdmissionWhereInput = { clinicId };

    if (filters.status) where.status = filters.status;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.wardId) where.bed = { wardId: filters.wardId };
    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { patient: { name: { contains: term } } },
        { patient: { uhid: { contains: term } } },
        { doctor: { name: { contains: term } } },
        { reasonForAdmission: { contains: term } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.admission.findMany({
        where,
        include: ADMISSION_INCLUDE,
        orderBy: { admissionDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.admission.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(clinicId: string, id: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id, clinicId },
      include: ADMISSION_INCLUDE,
    });
    if (!admission) {
      throw new NotFoundException(`Admission ID ${id} not found`);
    }
    return admission;
  }

  async discharge(clinicId: string, id: string, dto: DischargeAdmissionDto, requestingUser: any) {
    return this.prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findFirst({ where: { id, clinicId } });
      if (!admission) {
        throw new NotFoundException(`Admission ID ${id} not found`);
      }
      if (admission.status === 'DISCHARGED') {
        throw new ConflictException('This patient has already been discharged');
      }

      await tx.bed.update({ where: { id: admission.bedId }, data: { status: 'AVAILABLE' } });

      return tx.admission.update({
        where: { id },
        data: {
          status: 'DISCHARGED',
          dischargeDate: new Date(),
          dischargeSummary: dto.dischargeSummary,
          dischargedById: requestingUser.id,
        },
        include: ADMISSION_INCLUDE,
      });
    }, TRANSACTION_OPTIONS);
  }

  async addProgressNote(clinicId: string, admissionId: string, dto: CreateProgressNoteDto, requestingUser: any) {
    const admission = await this.findOne(clinicId, admissionId);

    // Author attribution is derived from the requester's role, not accepted from the
    // client, so a note can't be misattributed to the wrong kind of author.
    const noteType = requestingUser.role === 'NURSE' ? 'NURSE' : 'DOCTOR';

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.progressNote.create({
        data: {
          clinicId,
          admissionId: admission.id,
          authorId: requestingUser.id,
          noteType,
          note: dto.note,
          status: dto.status,
          bloodPressure: dto.bloodPressure,
          pulse: dto.pulse,
          temperature: dto.temperature,
          spo2: dto.spo2,
        },
        include: { author: { select: { id: true, name: true, role: true } } },
      });

      // The note is the audit trail; currentStatus is just a cache of the latest
      // one for the board/header to show without re-reading the whole feed.
      if (dto.status) {
        await tx.admission.update({ where: { id: admission.id }, data: { currentStatus: dto.status } });
      }

      return note;
    }, TRANSACTION_OPTIONS);
  }

  async getProgressNotes(clinicId: string, admissionId: string) {
    await this.findOne(clinicId, admissionId); // Ensure existence and clinic ownership
    return this.prisma.progressNote.findMany({
      where: { admissionId, clinicId },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
