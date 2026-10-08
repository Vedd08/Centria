import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { CommissionsService } from '../commissions/commissions.service';

/** Roles that may be recorded as the attending doctor on a visit. */
const DOCTOR_ROLES = ['DOCTOR', 'MASTER', 'SUPER_ADMIN'];

/** Roles that may be recorded as the relationship manager on a visit. */
const RM_ROLES = ['RM', 'RECEPTION', 'MASTER', 'SUPER_ADMIN'];

@Injectable()
export class VisitsService {
  constructor(
    private prisma: PrismaService,
    private commissionsService: CommissionsService,
  ) {}

  async create(clinicId: string, createVisitDto: CreateVisitDto) {
    // 1. Verify Patient belongs to this clinic
    const patient = await this.prisma.patient.findFirst({
      where: { id: createVisitDto.patientId, clinicId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${createVisitDto.patientId} not found in this clinic`);
    }

    // 2. Verify Doctor and RM User relations exist
    const doctorUser = await this.prisma.user.findFirst({
      where: { id: createVisitDto.doctorId, clinicId },
    });
    if (!doctorUser || !DOCTOR_ROLES.includes(doctorUser.role)) {
      throw new BadRequestException(`Invalid Doctor User ID ${createVisitDto.doctorId}`);
    }

    // The RM is optional — the clinic's day-books record one only occasionally.
    let rmUser: { id: string } | null = null;
    if (createVisitDto.rmId) {
      const found = await this.prisma.user.findFirst({
        where: { id: createVisitDto.rmId, clinicId },
      });
      if (!found || !RM_ROLES.includes(found.role)) {
        throw new BadRequestException(`Invalid RM User ID ${createVisitDto.rmId}`);
      }
      rmUser = found;
    }

    // 3. Business Rule 1: Look up TreatmentMaster and auto-fill GST Taxability.
    // Also optional — a few day-book rows carry a diagnosis but no treatment.
    let treatment: { id: string; name: string; price: any; isGstTaxable: boolean } | null = null;
    if (createVisitDto.treatmentId) {
      treatment = await this.prisma.treatmentMaster.findFirst({
        where: { id: createVisitDto.treatmentId, clinicId },
      });
      if (!treatment) {
        throw new NotFoundException(`Treatment with ID ${createVisitDto.treatmentId} not found`);
      }
    }

    // 4. Business Rule 2: Package & Sittings Validation
    let packagePurchaseRecord: any = null;
    if (createVisitDto.packagePurchaseId) {
      packagePurchaseRecord = await this.prisma.packagePurchase.findFirst({
        where: { id: createVisitDto.packagePurchaseId, clinicId },
      });

      if (!packagePurchaseRecord) {
        throw new NotFoundException(`Package purchase ID ${createVisitDto.packagePurchaseId} not found`);
      }

      if (packagePurchaseRecord.sittingsRemaining <= 0) {
        throw new BadRequestException(
          `Business Rule 2 Violation: Package '${packagePurchaseRecord.packageName}' has 0 remaining sittings! Cannot bill visit against exhausted package.`
        );
      }
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const basePrice = treatment?.price ?? 0;

    // 5. Execute atomic transaction to save Visit & decrement sittings
    const newVisit = await this.prisma.$transaction(async (tx) => {
      if (packagePurchaseRecord) {
        await tx.packagePurchase.update({
          where: { id: packagePurchaseRecord.id },
          data: {
            sittingsUsed: packagePurchaseRecord.sittingsUsed + 1,
            sittingsRemaining: packagePurchaseRecord.sittingsRemaining - 1,
          },
        });
      }

      return tx.visit.create({
        data: {
          clinicId,
          date: createVisitDto.date || todayDate,
          visitType: createVisitDto.visitType || 'OPD',
          patientId: createVisitDto.patientId,
          doctorId: doctorUser.id,
          rmId: rmUser ? rmUser.id : null,
          clientRm: createVisitDto.clientRm,
          operator: createVisitDto.operator, // Free text (intentional)
          treatmentId: treatment ? treatment.id : null,
          treatmentName: treatment ? treatment.name : 'Not Specified',
          treatmentPrice: basePrice,
          isGstTaxable: treatment ? treatment.isGstTaxable : false, // BUSINESS RULE 1: Auto-filled from TreatmentMaster
          packagePurchaseId: packagePurchaseRecord ? packagePurchaseRecord.id : null,
          diagnosis: createVisitDto.diagnosis,
          remarks: createVisitDto.remarks,
          otherRemarks: createVisitDto.otherRemarks,
          cashAmount: createVisitDto.cashAmount ?? 0,
          bankAmount: createVisitDto.bankAmount ?? 0,
          paymentRefId: createVisitDto.paymentRefId,
          status: createVisitDto.status, // BUSINESS RULE 3: Determines if commission is earned ("New" vs others)
          nextAppointmentDate: createVisitDto.nextAppointmentDate || null,
        },
        include: {
          patient: true,
          doctor: true,
          rm: true,
          treatment: true,
          packagePurchase: true,
        },
      });
    }, TRANSACTION_OPTIONS);

    // 6. BUSINESS RULE 3 ENGINE CALL: Auto-calculate commissions ONLY if status is "New"
    await this.commissionsService.calculateForVisit(clinicId, newVisit.id);

    return this.findOne(clinicId, newVisit.id);
  }

  async update(clinicId: string, id: string, updateDto: UpdateVisitDto, requestingUser?: any) {
    const existing = await this.findOne(clinicId, id);

    // SERVICE LAYER GUARD: DOCTOR can only edit their OWN visits
    if (requestingUser && requestingUser.role === 'DOCTOR') {
      if (existing.doctorId !== requestingUser.id) {
        throw new ForbiddenException('Doctors can only edit their own visit records');
      }
    }

    const data: Prisma.VisitUpdateInput = {};

    if (updateDto.operator !== undefined) data.operator = updateDto.operator;
    if (updateDto.diagnosis !== undefined) data.diagnosis = updateDto.diagnosis;
    if (updateDto.status !== undefined) data.status = updateDto.status;
    if (updateDto.date !== undefined) data.date = updateDto.date;
    if (updateDto.visitType !== undefined) data.visitType = updateDto.visitType;
    if (updateDto.clientRm !== undefined) data.clientRm = updateDto.clientRm;
    if (updateDto.remarks !== undefined) data.remarks = updateDto.remarks;
    if (updateDto.otherRemarks !== undefined) data.otherRemarks = updateDto.otherRemarks;
    if (updateDto.cashAmount !== undefined) data.cashAmount = updateDto.cashAmount;
    if (updateDto.bankAmount !== undefined) data.bankAmount = updateDto.bankAmount;
    if (updateDto.paymentRefId !== undefined) data.paymentRefId = updateDto.paymentRefId;
    if (updateDto.nextAppointmentDate !== undefined) {
      data.nextAppointmentDate = updateDto.nextAppointmentDate;
    }

    if (updateDto.doctorId !== undefined) {
      const doctorUser = await this.prisma.user.findFirst({ where: { id: updateDto.doctorId, clinicId } });
      if (!doctorUser || !DOCTOR_ROLES.includes(doctorUser.role)) {
        throw new BadRequestException(`Invalid Doctor User ID ${updateDto.doctorId}`);
      }
      data.doctor = { connect: { id: doctorUser.id } };
    }

    if (updateDto.rmId !== undefined) {
      const rmUser = await this.prisma.user.findFirst({ where: { id: updateDto.rmId, clinicId } });
      if (!rmUser || !RM_ROLES.includes(rmUser.role)) {
        throw new BadRequestException(`Invalid RM User ID ${updateDto.rmId}`);
      }
      data.rm = { connect: { id: rmUser.id } };
    }

    // BUSINESS RULE 1: taxability and price always come from TreatmentMaster, so a
    // treatment change re-derives them here rather than trusting the request body.
    if (updateDto.treatmentId !== undefined && updateDto.treatmentId !== existing.treatmentId) {
      const treatment = await this.prisma.treatmentMaster.findFirst({
        where: { id: updateDto.treatmentId, clinicId },
      });
      if (!treatment) {
        throw new NotFoundException(`Treatment with ID ${updateDto.treatmentId} not found`);
      }
      data.treatment = { connect: { id: treatment.id } };
      data.treatmentName = treatment.name;
      data.treatmentPrice = treatment.price;
      data.isGstTaxable = treatment.isGstTaxable;
    }

    const updated = await this.prisma.visit.update({
      where: { id },
      data,
      include: {
        patient: true,
        doctor: true,
        rm: true,
        treatment: true,
        packagePurchase: true,
      },
    });

    // BUSINESS RULE 3: keep the commission ledger in step with the visit. A status flip
    // or a repriced treatment invalidates whatever was calculated at creation time.
    const statusChanged = updateDto.status !== undefined && updateDto.status !== existing.status;
    const treatmentChanged = data.treatment !== undefined;
    if (statusChanged || treatmentChanged) {
      await this.commissionsService.recalculateForVisit(clinicId, updated.id);
    }

    return this.findOne(clinicId, updated.id);
  }

  async findAll(
    clinicId: string,
    filters: {
      patientId?: string;
      doctorId?: string;
      rmId?: string;
      visitType?: string;
      from?: string;
      to?: string;
      status?: string;
      search?: string;
    } = {},
    page: number = 1,
    pageSize: number = 20,
  ) {
    const where: Prisma.VisitWhereInput = { clinicId };

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.rmId) where.rmId = filters.rmId;
    if (filters.visitType) where.visitType = filters.visitType;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.date = {} as any;
      if (filters.from) (where.date as any).gte = filters.from;
      if (filters.to) (where.date as any).lte = filters.to;
    }
    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { treatmentName: { contains: term } },
        { operator: { contains: term } },
        { diagnosis: { contains: term } },
        { patient: { name: { contains: term } } },
        { patient: { uhid: { contains: term } } },
        { doctor: { name: { contains: term } } },
        { rm: { name: { contains: term } } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.visit.findMany({
        where,
        include: {
          patient: true,
          doctor: true,
          rm: true,
          treatment: true,
          packagePurchase: true,
          commissionRecords: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.visit.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(clinicId: string, id: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, clinicId },
      include: {
        patient: true,
        doctor: true,
        rm: true,
        treatment: true,
        packagePurchase: true,
        commissionRecords: true,
      },
    });
    if (!visit) {
      throw new NotFoundException(`Visit ID ${id} not found`);
    }
    return visit;
  }

  async remove(clinicId: string, id: string) {
    const visit = await this.findOne(clinicId, id);
    await this.prisma.$transaction(async (tx) => {
      if (visit.packagePurchaseId) {
        await tx.packagePurchase.update({
          where: { id: visit.packagePurchaseId },
          data: {
            sittingsUsed: { decrement: 1 },
            sittingsRemaining: { increment: 1 },
          },
        });
      }
      await tx.visit.delete({ where: { id } });
    }, TRANSACTION_OPTIONS);
    return { message: 'Visit deleted successfully' };
  }
}