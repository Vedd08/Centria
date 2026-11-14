import { toLocalDateKey } from '../common/date.helper';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageTypeDto } from './dto/create-package-type.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { UpdatePackagePlanDto, DoctorDelayDto, PatientLapseDto, CreateHolidayDto } from './dto/package-plan.dto';
import { addDays, computePlan, isValidDate, sittingBlockReason } from './package-plan';

const PLAN_INCLUDE = {
  visits: { select: { date: true }, orderBy: { date: 'asc' as const } },
  adjustments: { orderBy: { createdAt: 'desc' as const } },
} as const;

@Injectable()
export class PackagesService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  async createPackageType(user: any, dto: CreatePackageTypeDto) {
    const isDoctor = user.role === 'DOCTOR';
    return this.prisma.packageType.create({
      data: {
        clinicId: user.clinicId,
        name: dto.name.trim(),
        description: dto.description,
        price: dto.price,
        totalSittings: dto.totalSittings,
        isGstTaxable: dto.isGstTaxable ?? true,
        sittingGapDays: dto.sittingGapDays,
        validityDays: dto.validityDays ?? null,
        skipSundays: dto.skipSundays ?? true,
        skipHolidays: dto.skipHolidays ?? true,
        isActive: dto.isActive ?? true,
        treatmentId: dto.treatmentId,
        doctorId: isDoctor ? user.id : dto.doctorId,
      },
    });
  }

  async findAllPackageTypes(clinicId: string) {
    return this.prisma.packageType.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
    });
  }

  async updatePackageType(user: any, id: string, dto: CreatePackageTypeDto) {
    const pkg = await this.prisma.packageType.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!pkg) throw new NotFoundException(`Package type ID ${id} not found in this clinic`);

    if (user.role === 'DOCTOR' && pkg.doctorId !== user.id) {
      throw new ForbiddenException(`You can only edit your own packages`);
    }

    return this.prisma.packageType.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description,
        price: dto.price,
        totalSittings: dto.totalSittings,
        isGstTaxable: dto.isGstTaxable ?? true,
        sittingGapDays: dto.sittingGapDays,
        // Applies to future sales only; packages already sold keep their own terms.
        validityDays: dto.validityDays === undefined ? undefined : dto.validityDays,
        skipSundays: dto.skipSundays,
        skipHolidays: dto.skipHolidays,
        isActive: dto.isActive ?? pkg.isActive,
        treatmentId: dto.treatmentId,
        doctorId: user.role === 'DOCTOR' ? user.id : dto.doctorId,
      },
    });
  }

  async removePackageType(user: any, id: string) {
    const pkg = await this.prisma.packageType.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!pkg) throw new NotFoundException(`Package type ID ${id} not found in this clinic`);

    if (user.role === 'DOCTOR' && pkg.doctorId !== user.id) {
      throw new ForbiddenException(`You can only delete your own packages`);
    }

    const salesCount = await this.prisma.packagePurchase.count({ where: { packageTypeId: id } });
    if (salesCount > 0) {
      await this.prisma.packageType.update({ where: { id }, data: { isActive: false } });
      return { message: 'Package type has active sales, marked as inactive' };
    }

    await this.prisma.packageType.delete({ where: { id } });
    return { message: 'Package type deleted successfully' };
  }

  async purchasePackage(clinicId: string, dto: PurchasePackageDto, user?: { id: string; name?: string }) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, clinicId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ID ${dto.patientId} not found in this clinic`);
    }

    const pkgType = await this.prisma.packageType.findFirst({
      where: { id: dto.packageTypeId, clinicId },
    });
    if (!pkgType) {
      throw new NotFoundException(`PackageType ID ${dto.packageTypeId} not found in this clinic`);
    }

    const todayDate = toLocalDateKey(new Date());

    // Every rupee below the list price is a discount that accounts must see, with
    // who gave it and why. A discount can be sent explicitly; an amount below the
    // list price (older screens) is recorded as a discount too, never silently.
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const listPrice = Number(pkgType.price);
    let discountAmount: number;
    let amountPaid: number;
    if (dto.discount !== undefined) {
      discountAmount = round2(Number(dto.discount));
      amountPaid = round2(listPrice - discountAmount);
    } else {
      amountPaid = round2(dto.amountPaid !== undefined ? Number(dto.amountPaid) : listPrice);
      discountAmount = round2(Math.max(0, listPrice - amountPaid));
    }
    if (discountAmount > listPrice) {
      throw new BadRequestException(`Discount cannot be more than the package price (₹${listPrice})`);
    }
    let discountReason = dto.discountReason?.trim() || null;
    if (discountAmount > 0 && !discountReason) {
      if (dto.discount !== undefined) throw new BadRequestException('Enter a reason for the discount');
      discountReason = 'Price lowered at sale';
    }
    const hasDiscount = discountAmount > 0;

    const purchase = await this.prisma.$transaction(async (tx) => {
      // 1. Save PackagePurchase record. The plan terms (validity, Sunday/holiday
      // rules) are copied so later catalogue edits don't change a sold package.
      const saleDate = dto.purchaseDate || todayDate;
      const created = await tx.packagePurchase.create({
        data: {
          clinicId,
          patientId: patient.id,
          packageTypeId: pkgType.id,
          packageName: pkgType.name,
          validityDays: pkgType.validityDays,
          skipSundays: pkgType.skipSundays,
          skipHolidays: pkgType.skipHolidays,
          expiryDate: pkgType.validityDays ? addDays(saleDate, pkgType.validityDays) : null,
          purchaseDate: saleDate,
          amountPaid,
          listPrice,
          discountAmount,
          discountReason: hasDiscount ? discountReason : null,
          discountById: hasDiscount ? user?.id ?? null : null,
          discountGivenBy: hasDiscount ? user?.name ?? null : null,
          totalSittings: pkgType.totalSittings,
          isGstTaxable: pkgType.isGstTaxable,
          sittingGapDays: pkgType.sittingGapDays,
          sittingsUsed: 0,
          openingSittingsUsed: 0,
          sittingsRemaining: pkgType.totalSittings,
        },
        include: {
          patient: true,
          packageType: true,
        },
      });

      // 2. Link visit and clear recommendation if requested
      if (dto.linkToQueueId) {
        const queueEntry = await tx.patientQueue.findFirst({
          where: { id: dto.linkToQueueId, clinicId },
          include: { visit: true }
        });
        
        if (queueEntry) {
          // Clear recommendation so it's not sold twice
          await tx.patientQueue.update({
            where: { id: queueEntry.id },
            data: { recommendedPackageTypeId: null }
          });

          // Link the visit if one exists (the doctor already assessed)
          if (queueEntry.visitId) {
            await this.linkVisitToPurchase(clinicId, queueEntry.visitId, created.id, patient.id, tx);
          }
        }
      }

      return created;
    });

    // 3. AUTOMATIC TAX INVOICE GENERATION AT PACKAGE SALE TIME:
    // Package purchase is the GST tax point (taxableValue + 9% CGST + 9% SGST)
    await this.invoicesService.create(clinicId, {
      packagePurchaseId: purchase.id,
      taxableValue: Number(amountPaid),
      paymentMethod: dto.paymentMethod || 'bank',
      paymentRef: dto.paymentRef || 'Package Sale Purchase',
    });

    // Fetch the updated purchase since linkVisitToPurchase might have updated sittingsUsed
    return this.prisma.packagePurchase.findUnique({
      where: { id: purchase.id },
      include: {
        patient: true,
        packageType: true,
      }
    });
  }

  async findAllPurchases(clinicId: string, patientId?: string) {
    const purchases = await this.prisma.packagePurchase.findMany({
      where: {
        clinicId,
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: true,
        packageType: true,
        invoices: true,
        ...PLAN_INCLUDE,
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.withPlans(clinicId, purchases);
  }

  async findActivePurchasesByPatient(clinicId: string, patientId: string) {
    const purchases = await this.prisma.packagePurchase.findMany({
      where: {
        clinicId,
        patientId,
        sittingsRemaining: { gt: 0 },
        lapsedAt: null,
      },
      include: {
        packageType: true,
        invoices: true,
        ...PLAN_INCLUDE,
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.withPlans(clinicId, purchases);
  }

  // ---------------------------------------------------------------------------
  // Sitting plan: schedule, expiry, doctor delays and patient lapses
  // ---------------------------------------------------------------------------

  async holidaySet(clinicId: string): Promise<Set<string>> {
    const rows = await this.prisma.clinicHoliday.findMany({ where: { clinicId }, select: { date: true } });
    return new Set(rows.map((r) => r.date));
  }

  /** Adds the computed `plan` (next sitting, expiry, state, schedule) to each purchase. */
  async withPlans<T extends { visits: { date: string }[] } & Record<string, any>>(clinicId: string, purchases: T[]) {
    const holidays = await this.holidaySet(clinicId);
    const today = toLocalDateKey(new Date());
    return purchases.map((p) => ({
      ...p,
      plan: computePlan({ ...p, visitDates: p.visits.map((v) => v.date) } as any, holidays, today),
    }));
  }

  private async purchaseOrThrow(clinicId: string, id: string) {
    const purchase = await this.prisma.packagePurchase.findFirst({ where: { id, clinicId } });
    if (!purchase) throw new NotFoundException(`Package purchase ${id} not found`);
    return purchase;
  }

  async findOnePurchase(clinicId: string, id: string) {
    await this.purchaseOrThrow(clinicId, id);
    const purchase = await this.prisma.packagePurchase.findUniqueOrThrow({
      where: { id },
      include: { patient: true, packageType: true, ...PLAN_INCLUDE },
    });
    return (await this.withPlans(clinicId, [purchase]))[0];
  }

  /** Doctor plans the next sitting (e.g. "20 days from now") and/or corrects the expiry. */
  async updatePlan(user: any, id: string, dto: UpdatePackagePlanDto) {
    const purchase = await this.purchaseOrThrow(user.clinicId, id);
    if (purchase.lapsedAt) throw new BadRequestException('This package has lapsed — reinstate it before planning sittings');

    const data: any = {};
    const changes: string[] = [];
    if (dto.plannedNextSitting !== undefined) {
      data.plannedNextSitting = dto.plannedNextSitting || null;
      changes.push(dto.plannedNextSitting ? `next sitting set to ${dto.plannedNextSitting}` : 'next sitting reset to the regular gap');
    }
    if (dto.expiryDate !== undefined) {
      if (dto.expiryDate && dto.expiryDate < purchase.purchaseDate) {
        throw new BadRequestException('Expiry cannot be before the purchase date');
      }
      data.expiryDate = dto.expiryDate || null;
      changes.push(dto.expiryDate ? `expiry set to ${dto.expiryDate}` : 'expiry removed');
    }
    if (!changes.length) throw new BadRequestException('Nothing to change');

    await this.prisma.$transaction([
      this.prisma.packagePurchase.update({ where: { id }, data }),
      this.prisma.packageAdjustment.create({
        data: {
          purchaseId: id,
          kind: 'RESCHEDULE',
          note: [changes.join('; '), dto.note?.trim()].filter(Boolean).join(' — '),
          byName: user.name || 'Doctor',
          byId: user.id,
        },
      }),
    ]);
    return this.findOnePurchase(user.clinicId, id);
  }

  /**
   * The doctor/clinic caused the delay. The package is extended by `days` — shown as a
   * red notice — and the remaining sittings stay covered at no charge. A planned next
   * sitting moves by the same number of days.
   */
  async doctorDelay(user: any, id: string, dto: DoctorDelayDto) {
    const purchase = await this.purchaseOrThrow(user.clinicId, id);
    if (purchase.lapsedAt) throw new BadRequestException('This package has lapsed — reinstate it first');
    if (purchase.sittingsRemaining <= 0) throw new BadRequestException('All sittings of this package are already used');

    const today = toLocalDateKey(new Date());
    // An already-expired package is extended from today, so the patient gets the full delay.
    const base = purchase.expiryDate && purchase.expiryDate < today ? today : purchase.expiryDate;
    await this.prisma.$transaction([
      this.prisma.packagePurchase.update({
        where: { id },
        data: {
          extendedDays: { increment: dto.days },
          expiryDate: base ? addDays(base, dto.days) : null,
          plannedNextSitting: purchase.plannedNextSitting
            ? addDays(purchase.plannedNextSitting < today ? today : purchase.plannedNextSitting, dto.days)
            : undefined,
        },
      }),
      this.prisma.packageAdjustment.create({
        data: { purchaseId: id, kind: 'DOCTOR_DELAY', days: dto.days, note: dto.note.trim(), byName: user.name || 'Doctor', byId: user.id },
      }),
    ]);
    return this.findOnePurchase(user.clinicId, id);
  }

  /** The patient missed it: the package lapses, remaining sittings are forfeited, and they buy again. */
  async patientLapse(user: any, id: string, dto: PatientLapseDto) {
    const purchase = await this.purchaseOrThrow(user.clinicId, id);
    if (purchase.lapsedAt) throw new BadRequestException('This package has already lapsed');
    if (purchase.sittingsRemaining <= 0) throw new BadRequestException('All sittings are used — nothing to lapse');

    const today = toLocalDateKey(new Date());
    await this.prisma.$transaction([
      this.prisma.packagePurchase.update({
        where: { id },
        data: { lapsedAt: today, lapseNote: dto.note?.trim() || null, plannedNextSitting: null },
      }),
      this.prisma.packageAdjustment.create({
        data: {
          purchaseId: id,
          kind: 'PATIENT_LAPSE',
          days: purchase.sittingsRemaining,
          note: dto.note?.trim() || `Missed by patient — ${purchase.sittingsRemaining} sitting(s) forfeited`,
          byName: user.name || 'Doctor',
          byId: user.id,
        },
      }),
    ]);
    return this.findOnePurchase(user.clinicId, id);
  }

  /** Undo a lapse marked by mistake. */
  async reinstate(user: any, id: string, note?: string) {
    const purchase = await this.purchaseOrThrow(user.clinicId, id);
    if (!purchase.lapsedAt) throw new BadRequestException('This package has not lapsed');
    await this.prisma.$transaction([
      this.prisma.packagePurchase.update({ where: { id }, data: { lapsedAt: null, lapseNote: null } }),
      this.prisma.packageAdjustment.create({
        data: { purchaseId: id, kind: 'REINSTATE', note: note?.trim() || 'Lapse undone', byName: user.name || 'Admin', byId: user.id },
      }),
    ]);
    return this.findOnePurchase(user.clinicId, id);
  }

  async listHolidays(clinicId: string) {
    return this.prisma.clinicHoliday.findMany({ where: { clinicId }, orderBy: { date: 'asc' } });
  }

  async addHoliday(clinicId: string, dto: CreateHolidayDto) {
    if (!isValidDate(dto.date)) throw new BadRequestException('Enter a valid date');
    const existing = await this.prisma.clinicHoliday.findFirst({ where: { clinicId, date: dto.date } });
    if (existing) throw new BadRequestException(`${dto.date} is already a holiday (${existing.name})`);
    return this.prisma.clinicHoliday.create({ data: { clinicId, date: dto.date, name: dto.name.trim() } });
  }

  async removeHoliday(clinicId: string, id: string) {
    const holiday = await this.prisma.clinicHoliday.findFirst({ where: { id, clinicId } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    await this.prisma.clinicHoliday.delete({ where: { id } });
    return { id, deleted: true };
  }

  async syncSittings(clinicId: string, packagePurchaseId: string, tx?: any) {
    const db = tx ?? this.prisma;
    const purchase = await db.packagePurchase.findFirst({
      where: { id: packagePurchaseId, clinicId },
    });
    if (!purchase) {
      throw new NotFoundException(`Package purchase ID ${packagePurchaseId} not found`);
    }

    const visitsCount = await db.visit.count({
      where: { packagePurchaseId, clinicId },
    });

    const sittingsUsed = purchase.openingSittingsUsed + visitsCount;
    if (sittingsUsed > purchase.totalSittings) {
      throw new BadRequestException(`Package has 0 remaining sittings`);
    }
    const sittingsRemaining = purchase.totalSittings - sittingsUsed;

    await db.packagePurchase.update({
      where: { id: packagePurchaseId },
      data: { sittingsUsed, sittingsRemaining },
    });
  }

  async linkVisitToPurchase(clinicId: string, visitId: string, purchaseId: string, patientId: string, tx: any) {
    const db = tx ?? this.prisma;
    
    // Safety 1: Check clinic scope and patient ownership
    const purchase = await db.packagePurchase.findFirst({
      where: { id: purchaseId, clinicId }
    });
    
    if (!purchase) {
      throw new NotFoundException(`Package purchase ID ${purchaseId} not found`);
    }
    
    if (purchase.patientId !== patientId) {
      throw new BadRequestException(`Package belongs to another patient (${purchase.patientId})`);
    }

    // Safety 1b: an expired or lapsed package can't take a new sitting. Re-saving a
    // visit that is already counted on this package is always allowed.
    const visit = await db.visit.findFirst({ where: { id: visitId }, select: { date: true, packagePurchaseId: true } });
    const isNewSitting = visit?.packagePurchaseId !== purchaseId;
    if (isNewSitting) {
      const blocked = sittingBlockReason(purchase, visit?.date || toLocalDateKey(new Date()));
      if (blocked) throw new BadRequestException(blocked);
    }

    // Safety 2: Ensure not already full before linking
    // We check current usage (including previously linked visits, not including this one if it's new)
    const visitsCount = await db.visit.count({
      where: { packagePurchaseId: purchaseId, clinicId, id: { not: visitId } },
    });
    if (purchase.openingSittingsUsed + visitsCount >= purchase.totalSittings) {
      throw new BadRequestException(`Package has 0 remaining sittings`);
    }

    // Link the visit
    await db.visit.update({
      where: { id: visitId },
      data: { packagePurchaseId: purchaseId }
    });

    // The doctor's planned date was for this sitting; the next one is planned afresh.
    if (isNewSitting && purchase.plannedNextSitting) {
      await db.packagePurchase.update({ where: { id: purchaseId }, data: { plannedNextSitting: null } });
    }

    // Re-sync sittings
    await this.syncSittings(clinicId, purchaseId, db);
  }
}
