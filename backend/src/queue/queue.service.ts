import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { CheckInDto } from './dto/check-in.dto';
import { AssessQueueDto } from './dto/assess-queue.dto';
import { UpdateQueueStatusDto } from './dto/update-queue-status.dto';
import { RequestAdmissionDto } from './dto/request-admission.dto';
import { UpdateBillPaymentDto } from './dto/update-bill-payment.dto';
import { cleanPaymentDetails, parsePaymentDetails, serializePaymentDetails } from '../common/payment-details';
import { toLocalDateKey } from '../common/date.helper';
import { textContains } from '../common/text-search';

const DOCTOR_ROLES = ['DOCTOR', 'MASTER', 'SUPER_ADMIN'];

/**
 * Ward nurses look after inpatients; service staff look after outpatients. Roles not
 * listed here (doctors, reception, admins) see the whole board.
 */
const CARE_TYPE_BY_ROLE: Record<string, string | undefined> = {
  NURSE: 'IPD',
  STAFF: 'OPD',
};

const QUEUE_INCLUDE = {
  patient: {
    include: {
      visits: {
        where: { conditionTrend: { not: null } },
        orderBy: { date: 'desc' },
        take: 1,
        select: { conditionTrend: true, date: true },
      },
      _count: {
        select: { visits: true }
      }
    },
  },
  department: { select: { id: true, name: true, code: true } },
  doctor: { select: { id: true, name: true, role: true } },
  checkedInBy: { select: { id: true, name: true, role: true } },
  admissionRequestedBy: { select: { id: true, name: true, role: true } },
  visit: { include: { treatment: true } },
  admission: { include: { bed: { include: { ward: true } } } },
  careOrders: {
    include: {
      medicine: true,
      treatment: true,
      orderedBy: { select: { id: true, name: true } },
      performedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  recommendedPackageType: true,
  bills: { select: { kind: true, billNumber: true, paymentStatus: true, paymentMode: true } },
} as const;

const today = () => toLocalDateKey(new Date());

/** Rounds a money figure to paise. Same convention as InvoicesService. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Orders the pharmacy dispenses — billed by the pharmacist for OPD patients. */
const PHARMACY_ORDER_TYPES = ['MEDICINE', 'INJECTION'];

export type BillKind = 'PATIENT' | 'PHARMACY';
const BILL_PREFIX: Record<BillKind, string> = { PATIENT: 'PB', PHARMACY: 'PH' };

export interface BillLine {
  description: string;
  kind: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxable: boolean;
  hsnCode?: string;
  taxRate?: number;
}

const orderLine = (order: any): BillLine => ({
  description: order.description,
  kind: order.orderType,
  quantity: order.quantity,
  unitPrice: Number(order.unitPrice),
  amount: Number(order.totalPrice),
  // Pharmacy items carry their own GST flag; anything else follows the
  // treatment it came from, and free-text services are exempt.
  taxable: order.medicine?.isGstTaxable ?? order.treatment?.isGstTaxable ?? false,
  hsnCode: order.medicine?.hsnCode ?? order.treatment?.hsnCode ?? undefined,
  taxRate: order.medicine?.taxRate ? Number(order.medicine.taxRate) : order.treatment?.taxRate ? Number(order.treatment.taxRate) : undefined,
});

import { PackagesService } from '../packages/packages.service';

@Injectable()
export class QueueService {
  constructor(
    private prisma: PrismaService,
    private packagesService: PackagesService
  ) {}

  /**
   * Reception check-in. Allocates the next token for the day and flags the patient
   * as "regular" when they already have history, so the doctor sees it at a glance.
   */
  async checkIn(clinicId: string, dto: CheckInDto, requestingUser: any) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${dto.patientId} not found in this clinic`);
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({ where: { id: dto.departmentId, clinicId } });
      if (!dept) throw new NotFoundException(`Department ${dto.departmentId} not found`);
      if (!dept.isActive) throw new BadRequestException(`${dept.name} is not currently taking patients`);
    }

    if (dto.doctorId) {
      const doctor = await this.prisma.user.findFirst({ where: { id: dto.doctorId, clinicId } });
      if (!doctor || !DOCTOR_ROLES.includes(doctor.role)) {
        throw new BadRequestException(`Invalid Doctor User ID ${dto.doctorId}`);
      }
      // Catch a mis-click before the patient is sent to the wrong clinic entirely.
      if (dto.departmentId && doctor.departmentId && doctor.departmentId !== dto.departmentId) {
        throw new BadRequestException(`${doctor.name} does not work in the department you selected`);
      }
    }

    const queueDate = dto.queueDate || today();

    // A patient already waiting today shouldn't be queued twice.
    const active = await this.prisma.patientQueue.findFirst({
      where: {
        clinicId,
        patientId: patient.id,
        queueDate,
        status: { in: ['WAITING', 'WITH_DOCTOR', 'AWAITING_SERVICE', 'IN_SERVICE'] },
      },
    });
    if (active) {
      throw new ConflictException(`${patient.name} is already in today's queue (token ${active.tokenNumber})`);
    }

    const priorVisits = await this.prisma.visit.count({ where: { patientId: patient.id, clinicId } });

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.patientQueue.findFirst({
        where: { clinicId, queueDate, departmentId: dto.departmentId ?? null },
        orderBy: { tokenNumber: 'desc' },
        select: { tokenNumber: true },
      });

      return tx.patientQueue.create({
        data: {
          clinicId,
          patientId: patient.id,
          queueDate,
          tokenNumber: (last?.tokenNumber ?? 0) + 1,
          complaint: dto.complaint,
          departmentId: dto.departmentId || null,
          isRegular: priorVisits > 0,
          careType: dto.careType || null,
          doctorId: dto.doctorId || null,
          checkedInById: requestingUser.id,
          status: 'WAITING',
        },
        include: QUEUE_INCLUDE,
      });
    }, TRANSACTION_OPTIONS);
  }

  async findAll(
    clinicId: string,
    filters: {
      date?: string;
      status?: string;
      doctorId?: string;
      departmentId?: string;
      patientId?: string;
      search?: string;
    } = {},
    requestingUser?: any,
  ) {
    const where: Prisma.PatientQueueWhereInput = { clinicId };

    // Default to today's board — the queue is a live, per-day working list.
    where.queueDate = filters.date || today();
    if (filters.patientId) {
      where.patientId = filters.patientId;
      delete where.queueDate; // A patient's own history spans every day.
    }
    if (filters.status) where.status = { in: filters.status.split(',').map((s) => s.trim()) };
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.departmentId) where.departmentId = filters.departmentId;

    const careTypeForRole = CARE_TYPE_BY_ROLE[requestingUser?.role];
    if (careTypeForRole) where.careType = careTypeForRole;

    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { patient: { name: textContains(term) } },
        { patient: { phone: textContains(term) } },
        { complaint: textContains(term) },
      ];
    }

    return this.prisma.patientQueue.findMany({
      where,
      include: QUEUE_INCLUDE,
      orderBy: [{ queueDate: 'desc' }, { tokenNumber: 'asc' }],
    });
  }

  async findOne(clinicId: string, id: string) {
    const entry = await this.prisma.patientQueue.findFirst({ where: { id, clinicId }, include: QUEUE_INCLUDE });
    if (!entry) {
      throw new NotFoundException(`Queue entry ${id} not found`);
    }
    return entry;
  }

  /**
   * Doctor's assessment. Records the findings, routes the patient to OPD or IPD,
   * and writes the encounter into the matching day book so the clinical record and
   * the registers stay in step.
   */
  async assess(clinicId: string, id: string, dto: AssessQueueDto, requestingUser: any) {
    const entry = await this.findOne(clinicId, id);
    if (entry.status === 'CANCELLED') {
      throw new BadRequestException('This queue entry was cancelled');
    }

    const doctorId = entry.doctorId ?? requestingUser.id;

    let treatment: { id: string; name: string; price: any; isGstTaxable: boolean } | null = null;
    if (dto.treatmentId) {
      treatment = await this.prisma.treatmentMaster.findFirst({ where: { id: dto.treatmentId, clinicId } });
      if (!treatment) {
        throw new NotFoundException(`Treatment with ID ${dto.treatmentId} not found`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.recommendedPackageTypeId) {
        const pkgType = await tx.packageType.findFirst({
          where: { id: dto.recommendedPackageTypeId, clinicId }
        });
        if (!pkgType || !pkgType.isActive) {
          throw new BadRequestException('Recommended package type is not active or not found');
        }
      }

      // Reuse the visit if the doctor re-saves their assessment, so repeated edits
      // don't litter the day book with duplicates.
      let visitId = entry.visitId;

      const visitData: any = {
        date: entry.queueDate,
        visitType: dto.careType,
        patientId: entry.patientId,
        doctorId,
        operator: requestingUser.name || 'Doctor',
        treatmentId: treatment?.id ?? null,
        treatmentName: treatment?.name ?? 'Consultation',
        treatmentPrice: treatment?.price ?? 0,
        isGstTaxable: treatment?.isGstTaxable ?? false,
        diagnosis: dto.diagnosis || null,
        remarks: dto.doctorNotes || null,
        nextAppointmentDate: dto.nextAppointmentDate || null,
        status: entry.isRegular ? 'Follow Up' : 'New',
        packagePurchaseId: dto.usePackagePurchaseId ? undefined : null,
        clinicId,
      };

      if (dto.conditionTrend !== undefined) {
        visitData.conditionTrend = dto.conditionTrend || null;
      }

      if (visitId) {
        await tx.visit.update({ where: { id: visitId }, data: visitData });
      } else {
        const created = await tx.visit.create({ data: visitData });
        visitId = created.id;
      }

      const queueData: any = {
        doctorId,
        careType: dto.careType,
        diagnosis: dto.diagnosis,
        doctorNotes: dto.doctorNotes,
        patientNotes: dto.patientNotes,
        staffNotes: dto.staffNotes,
        nextAppointmentDate: dto.nextAppointmentDate,
        ...(dto.consultationFee !== undefined ? { consultationFee: dto.consultationFee } : {}),
        seenAt: entry.seenAt ?? new Date(),
        // Handing over to the nurse/service desk is what "doctor is done" means.
        status: 'AWAITING_SERVICE',
        visitId,
      };

      if (dto.recommendedPackageTypeId !== undefined) {
        queueData.recommendedPackageTypeId = dto.recommendedPackageTypeId || null;
      }

      const updatedQueue = await tx.patientQueue.update({
        where: { id },
        data: queueData,
        include: QUEUE_INCLUDE,
      });

      if (dto.usePackagePurchaseId) {
        await this.packagesService.linkVisitToPurchase(clinicId, visitId, dto.usePackagePurchaseId, entry.patientId, tx);
      }
      
      const oldPackagePurchaseId = entry.visit?.packagePurchaseId;
      if (oldPackagePurchaseId && oldPackagePurchaseId !== dto.usePackagePurchaseId) {
        await this.packagesService.syncSittings(clinicId, oldPackagePurchaseId, tx);
      }

      return updatedQueue;
    }, TRANSACTION_OPTIONS);
  }

  /**
   * The doctor's call that this OPD patient needs to be admitted. This doesn't pick a
   * ward/bed itself — it raises a flag that the nurse's dashboard picks up, so the
   * bed assignment stays a ward-desk decision rather than something the doctor does
   * from the consultation screen.
   */
  async requestAdmission(clinicId: string, id: string, dto: RequestAdmissionDto, requestingUser: any) {
    const entry = await this.findOne(clinicId, id);
    if (entry.admissionId) {
      throw new ConflictException('This patient has already been admitted');
    }
    if (entry.status === 'CANCELLED') {
      throw new BadRequestException('This queue entry was cancelled');
    }

    return this.prisma.patientQueue.update({
      where: { id: entry.id },
      data: {
        careType: 'IPD',
        admissionRequestedAt: new Date(),
        admissionRequestedById: requestingUser.id,
        admissionRequestReason: dto.reason,
      },
      include: QUEUE_INCLUDE,
    });
  }

  /** Admission requests still waiting on a nurse to pick a ward/bed. */
  async findPendingAdmissions(clinicId: string) {
    return this.prisma.patientQueue.findMany({
      where: { clinicId, admissionRequestedAt: { not: null }, admissionId: null },
      include: QUEUE_INCLUDE,
      orderBy: { admissionRequestedAt: 'asc' },
    });
  }

  async updateStatus(clinicId: string, id: string, dto: UpdateQueueStatusDto) {
    const entry = await this.findOne(clinicId, id);

    // Reassigning to a different doctor keeps the patient in the same department,
    // so only the doctor needs checking here.
    if (dto.doctorId) {
      const doctor = await this.prisma.user.findFirst({ where: { id: dto.doctorId, clinicId } });
      if (!doctor || !DOCTOR_ROLES.includes(doctor.role)) {
        throw new BadRequestException(`Invalid Doctor User ID ${dto.doctorId}`);
      }
    }

    return this.prisma.patientQueue.update({
      where: { id: entry.id },
      data: {
        status: dto.status,
        ...(dto.doctorId ? { doctorId: dto.doctorId } : {}),
        ...(dto.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
      include: QUEUE_INCLUDE,
    });
  }

  /**
   * The consolidated bill for one encounter: the doctor's treatment line plus every
   * medicine/injection/procedure ordered, itemised for printing at the front desk.
   *
   * GST follows the same rule the invoice module uses — 9% CGST + 9% SGST on lines
   * flagged taxable. Pharmacy items carry no taxability flag in the catalogue, so
   * they are billed exempt rather than guessing a rate.
   */
  async getBill(clinicId: string, id: string) {
    const entry = await this.findOne(clinicId, id);

    const lines: BillLine[] = [];

    const fee = Number(entry.consultationFee ?? 0);
    if (fee > 0) {
      lines.push({
        description: `Consultation — ${entry.doctor?.name ?? 'Doctor'}`,
        kind: 'CONSULTATION',
        quantity: 1,
        unitPrice: fee,
        amount: fee,
        taxable: false, // Medical consultation is GST exempt.
      });
    }

    if (entry.visit && Number(entry.visit.treatmentPrice ?? 0) > 0) {
      const price = Number(entry.visit.treatmentPrice);
      lines.push({
        description: entry.visit.treatmentName || 'Treatment',
        kind: 'TREATMENT',
        quantity: 1,
        unitPrice: price,
        amount: price,
        taxable: entry.visit.isGstTaxable,
        hsnCode: entry.visit.treatment?.hsnCode ?? undefined,
        taxRate: entry.visit.treatment?.taxRate ? Number(entry.visit.treatment.taxRate) : undefined,
      });
    }

    for (const order of entry.careOrders) {
      if (order.status === 'CANCELLED') continue;
      
      // Exclusive Pharmacy Billing for OPD:
      // Walk-in patients pay the Pharmacist directly for drugs (see getPharmacyBill).
      // IPD patients have their drugs added to their consolidated discharge bill here.
      if (entry.careType === 'OPD' && PHARMACY_ORDER_TYPES.includes(order.orderType)) {
        continue;
      }

      lines.push(orderLine(order));
    }

    return this.composeBill(clinicId, entry, 'PATIENT', lines);
  }

  /**
   * The bill the pharmacist hands an OPD patient for the medicines and injections the
   * doctor ordered. Inpatients don't get one — their drugs are on the patient bill.
   */
  async getPharmacyBill(clinicId: string, id: string) {
    const entry = await this.findOne(clinicId, id);
    if (entry.careType !== 'OPD') {
      throw new BadRequestException(
        "Only OPD patients get a separate pharmacy bill — this patient's medicines are on the reception patient bill",
      );
    }

    const lines = entry.careOrders
      .filter((o) => o.status !== 'CANCELLED' && PHARMACY_ORDER_TYPES.includes(o.orderType))
      .map(orderLine);

    return this.composeBill(clinicId, entry, 'PHARMACY', lines);
  }

  /** Totals, invoice number and payment state shared by the patient and pharmacy bills. */
  private async composeBill(
    clinicId: string,
    entry: Awaited<ReturnType<QueueService['findOne']>>,
    kind: BillKind,
    lines: BillLine[],
  ) {
    // Money is settled in paise, so every figure that reaches a bill is rounded to two
    // decimals — matching InvoicesService. Left raw, 9% of a price carrying paise
    // (1149.50 -> 103.455) prints a third decimal, and binary floating point turns
    // 9% of 99.99 into 8.999099999999999.
    const subTotal = round2(lines.reduce((acc, l) => acc + l.amount, 0));
    const taxableValue = round2(lines.filter((l) => l.taxable).reduce((acc, l) => acc + l.amount, 0));
    const exemptValue = round2(subTotal - taxableValue);
    
    let totalCgst = 0;
    let totalSgst = 0;
    for (const l of lines) {
      if (l.taxable) {
        const rate = l.taxRate ?? 18;
        const cgstRate = rate / 2;
        const sgstRate = rate / 2;
        totalCgst += l.amount * (cgstRate / 100);
        totalSgst += l.amount * (sgstRate / 100);
      }
    }
    const cgst = round2(totalCgst);
    const sgst = round2(totalSgst);

    const bill = await this.ensureBillRecord(clinicId, entry.id, kind);

    return {
      kind,
      queueId: entry.id,
      tokenNumber: entry.tokenNumber,
      queueDate: entry.queueDate,
      billNumber: bill.billNumber,
      paymentStatus: bill.paymentStatus,
      paymentMode: bill.paymentMode,
      paymentDetails: parsePaymentDetails(bill.paymentDetails),
      paidAt: bill.paidAt,
      receivedBy: bill.receivedBy,
      careType: entry.careType,
      patient: entry.patient,
      doctor: entry.doctor,
      lines,
      subTotal,
      taxableValue,
      exemptValue,
      cgst,
      sgst,
      totalAmount: round2(subTotal + cgst + sgst),
    };
  }

  /**
   * The encounter's bill record, created on first open with the next invoice number
   * (PB-<year>-0001 for patient bills, PH-<year>-0001 for pharmacy bills, counting up
   * per clinic per year). Reprints find the existing record and keep its number.
   */
  private async ensureBillRecord(clinicId: string, queueId: string, kind: BillKind) {
    const prefix = `${BILL_PREFIX[kind]}-${new Date().getFullYear()}-`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await this.prisma.encounterBill.findUnique({ where: { queueId_kind: { queueId, kind } } });
      if (existing) return existing;

      const latest = await this.prisma.encounterBill.findFirst({
        where: { clinicId, billNumber: { startsWith: prefix } },
        orderBy: { billNumber: 'desc' },
        select: { billNumber: true },
      });
      const parsed = latest ? parseInt(latest.billNumber.slice(prefix.length), 10) : 0;
      const billNumber = `${prefix}${((Number.isNaN(parsed) ? 0 : parsed) + 1).toString().padStart(4, '0')}`;

      try {
        return await this.prisma.encounterBill.create({ data: { clinicId, queueId, kind, billNumber } });
      } catch (error) {
        // Another request opened this bill, or took the same number, at the same
        // moment — loop round to pick up its record or the next free number.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
    }
    throw new ConflictException('Could not assign an invoice number to this bill, please retry');
  }

  /**
   * Marks an encounter's patient or pharmacy bill paid — with the mode and its
   * details (transaction ID, account, card, UPI…) — or back to unpaid.
   */
  async updateBillPayment(clinicId: string, id: string, kind: BillKind, dto: UpdateBillPaymentDto, user: any) {
    const load = () => (kind === 'PHARMACY' ? this.getPharmacyBill(clinicId, id) : this.getBill(clinicId, id));
    const { queueId } = await load(); // Checks access and makes sure the bill record exists.

    const data: Prisma.EncounterBillUpdateInput =
      dto.status === 'PAID'
        ? {
            paymentStatus: 'PAID',
            paymentMode: dto.mode,
            paymentDetails: serializePaymentDetails(cleanPaymentDetails(dto.mode!, dto.details)),
            paidAt: new Date(),
            receivedBy: user?.name ?? null,
          }
        : { paymentStatus: 'UNPAID', paymentMode: null, paymentDetails: null, paidAt: null, receivedBy: null };

    await this.prisma.encounterBill.update({ where: { queueId_kind: { queueId, kind } }, data });
    return load();
  }

  /**
   * The prescription the patient takes home. Deliberately excludes staffNotes —
   * those are internal instructions for the nurse/service desk.
   */
  async getPrescription(clinicId: string, id: string) {
    const entry = await this.findOne(clinicId, id);

    const medicines = entry.careOrders
      .filter((o) => o.status !== 'CANCELLED' && ['MEDICINE', 'INJECTION'].includes(o.orderType))
      .map((o) => ({
        description: o.description,
        orderType: o.orderType,
        dosage: o.dosage,
        route: o.route,
        frequency: o.frequency,
        instructions: o.instructions,
        quantity: o.quantity,
        medicineId: o.medicineId,
      }));

    const procedures = entry.careOrders
      .filter((o) => o.status !== 'CANCELLED' && !['MEDICINE', 'INJECTION'].includes(o.orderType))
      .map((o) => ({ description: o.description, instructions: o.instructions }));

    return {
      queueId: entry.id,
      tokenNumber: entry.tokenNumber,
      queueDate: entry.queueDate,
      careType: entry.careType,
      patient: entry.patient,
      doctor: entry.doctor,
      diagnosis: entry.diagnosis,
      patientNotes: entry.patientNotes,
      nextAppointmentDate: entry.nextAppointmentDate,
      medicines,
      procedures,
    };
  }

  /** Counts for the day, so each desk can see what is waiting on them. */
  async getStats(clinicId: string, date?: string) {
    const queueDate = date || today();
    const grouped = await this.prisma.patientQueue.groupBy({
      by: ['status'],
      where: { clinicId, queueDate },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    const pendingOrders = await this.prisma.careOrder.count({
      where: { clinicId, status: 'ORDERED', queue: { queueDate } },
    });

    return {
      date: queueDate,
      waiting: counts['WAITING'] ?? 0,
      withDoctor: counts['WITH_DOCTOR'] ?? 0,
      awaitingService: counts['AWAITING_SERVICE'] ?? 0,
      inService: counts['IN_SERVICE'] ?? 0,
      completed: counts['COMPLETED'] ?? 0,
      cancelled: counts['CANCELLED'] ?? 0,
      pendingCareOrders: pendingOrders,
    };
  }
}
