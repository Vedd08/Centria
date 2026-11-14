import { toLocalDateKey } from '../common/date.helper';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageTypeDto } from './dto/create-package-type.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { UpdatePackagePlanDto, DoctorDelayDto, PatientLapseDto, CreateHolidayDto } from './dto/package-plan.dto';
import { addDays, computePurchasePlan, isValidDate, itemUsed, sittingBlockReason } from './package-plan';

const PLAN_INCLUDE = {
  visits: { select: { date: true }, orderBy: { date: 'asc' as const } },
  adjustments: { orderBy: { createdAt: 'desc' as const } },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: { sittings: { select: { date: true, visitId: true }, orderBy: { date: 'asc' as const } } },
  },
} as const;

@Injectable()
export class PackagesService implements OnModuleInit {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  /** Runs before the app takes requests, so every package has treatment lines. */
  async onModuleInit() {
    try {
      await this.migrateToTreatmentLines();
    } catch (err) {
      this.logger.error('Could not convert packages to treatment lines', err as any);
    }
  }

  /**
   * One-time, repeat-safe conversion: packages and sales set up before treatment
   * lines existed become a single treatment line, and the visits already counted
   * become that line's sittings. Nothing changes for the patient.
   */
  async migrateToTreatmentLines() {
    const types = await this.prisma.packageType.findMany({
      where: { items: { none: {} } },
      include: { treatment: { select: { name: true } } },
    });
    for (const t of types) {
      await this.prisma.packageTypeItem
        .create({
          data: {
            packageTypeId: t.id,
            treatmentId: t.treatmentId,
            name: t.treatment?.name ?? t.name,
            sittings: Math.max(1, t.totalSittings || 1),
            sittingGapDays: t.sittingGapDays,
            sortOrder: 0,
          },
        })
        .catch(() => undefined); // Another instance got there first.
    }

    const purchases = await this.prisma.packagePurchase.findMany({
      where: { items: { none: {} } },
      include: {
        packageType: { include: { treatment: { select: { name: true } } } },
        visits: { select: { id: true, date: true } },
      },
    });
    for (const p of purchases) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const item = await tx.packagePurchaseItem.create({
            data: {
              purchaseId: p.id,
              treatmentId: p.packageType?.treatmentId ?? null,
              name: p.packageType?.treatment?.name ?? p.packageName,
              totalSittings: Math.max(1, p.totalSittings || p.sittingsUsed + p.sittingsRemaining || 1),
              sittingGapDays: p.sittingGapDays ?? p.packageType?.sittingGapDays ?? null,
              openingSittingsUsed: p.openingSittingsUsed,
              plannedNextSitting: p.plannedNextSitting,
              sortOrder: 0,
            },
          });
          if (p.visits.length) {
            await tx.packageSitting.createMany({
              data: p.visits.map((v) => ({ purchaseId: p.id, itemId: item.id, visitId: v.id, date: v.date, byName: 'Earlier records' })),
            });
          }
        }, TRANSACTION_OPTIONS);
      } catch (err: any) {
        // Usually another instance converted it first; log anything else.
        this.logger.warn(`Treatment lines for sale ${p.id} skipped: ${err?.message ?? err}`);
      }
    }
    if (types.length || purchases.length) {
      this.logger.log(`Treatment lines: converted ${types.length} package type(s) and ${purchases.length} sale(s)`);
    }
  }

  /**
   * Turns the request into treatment lines (name resolved from the catalogue) plus
   * the summary fields older screens read: total sittings, first treatment and gap.
   */
  private async buildTypeItems(clinicId: string, dto: CreatePackageTypeDto) {
    const raw = dto.items?.length
      ? dto.items
      : [{ treatmentId: dto.treatmentId, name: undefined, sittings: dto.totalSittings ?? 0, sittingGapDays: dto.sittingGapDays }];
    if (!raw.length || raw.some((i) => !i.sittings || i.sittings < 1)) {
      throw new BadRequestException('Add at least one treatment with 1 or more sittings');
    }
    const ids = raw.map((i) => i.treatmentId).filter(Boolean) as string[];
    const treatments = ids.length
      ? await this.prisma.treatmentMaster.findMany({ where: { id: { in: ids }, clinicId }, select: { id: true, name: true } })
      : [];
    const items = raw.map((i, idx) => {
      const t = treatments.find((x) => x.id === i.treatmentId);
      if (i.treatmentId && !t) throw new NotFoundException(`Treatment ${i.treatmentId} not found`);
      const name = (i.name?.trim() || t?.name || dto.name || '').trim();
      if (!name) throw new BadRequestException('Each treatment needs a name');
      return { treatmentId: t?.id ?? null, name, sittings: i.sittings, sittingGapDays: i.sittingGapDays ?? null, sortOrder: idx };
    });
    return {
      items,
      totalSittings: items.reduce((s, i) => s + i.sittings, 0),
      treatmentId: items[0].treatmentId,
      sittingGapDays: items[0].sittingGapDays,
    };
  }

  async createPackageType(user: any, dto: CreatePackageTypeDto) {
    const isDoctor = user.role === 'DOCTOR';
    const built = await this.buildTypeItems(user.clinicId, dto);
    return this.prisma.packageType.create({
      data: {
        clinicId: user.clinicId,
        name: dto.name.trim(),
        description: dto.description,
        price: dto.price,
        totalSittings: built.totalSittings,
        isGstTaxable: dto.isGstTaxable ?? true,
        sittingGapDays: built.sittingGapDays,
        validityDays: dto.validityDays ?? null,
        skipSundays: dto.skipSundays ?? true,
        skipHolidays: dto.skipHolidays ?? true,
        isActive: dto.isActive ?? true,
        treatmentId: built.treatmentId,
        doctorId: isDoctor ? user.id : dto.doctorId,
        items: { create: built.items },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findAllPackageTypes(clinicId: string) {
    return this.prisma.packageType.findMany({
      where: { clinicId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async updatePackageType(user: any, id: string, dto: CreatePackageTypeDto) {
    const pkg = await this.prisma.packageType.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!pkg) throw new NotFoundException(`Package type ID ${id} not found in this clinic`);

    // A doctor edits their own packages and clinic-wide ones (no owner), but not
    // another doctor's.
    if (user.role === 'DOCTOR' && pkg.doctorId && pkg.doctorId !== user.id) {
      throw new ForbiddenException(`This package belongs to another doctor`);
    }

    const built = await this.buildTypeItems(user.clinicId, dto);
    return this.prisma.$transaction(async (tx) => {
      // Treatment lines have no natural key, so they are replaced wholesale. Packages
      // already sold keep their own copy, so this only affects new sales.
      await tx.packageTypeItem.deleteMany({ where: { packageTypeId: id } });
      return tx.packageType.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          description: dto.description,
          price: dto.price,
          totalSittings: built.totalSittings,
          isGstTaxable: dto.isGstTaxable ?? true,
          sittingGapDays: built.sittingGapDays,
          validityDays: dto.validityDays === undefined ? undefined : dto.validityDays,
          skipSundays: dto.skipSundays,
          skipHolidays: dto.skipHolidays,
          isActive: dto.isActive ?? pkg.isActive,
          treatmentId: built.treatmentId,
          // Editing never changes who owns the package (a doctor editing a clinic-wide
          // package doesn't take it over).
          doctorId: user.role === 'DOCTOR' ? pkg.doctorId : dto.doctorId,
          items: { create: built.items },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    }, TRANSACTION_OPTIONS);
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
      include: { items: { orderBy: { sortOrder: 'asc' } }, treatment: { select: { name: true } } },
    });
    if (!pkgType) {
      throw new NotFoundException(`PackageType ID ${dto.packageTypeId} not found in this clinic`);
    }
    // Treatment lines copied onto the sale (a package set up before treatment lines
    // existed counts as one treatment).
    const saleItems = pkgType.items.length
      ? pkgType.items.map((i, idx) => ({ treatmentId: i.treatmentId, name: i.name, totalSittings: i.sittings, sittingGapDays: i.sittingGapDays, sortOrder: idx }))
      : [{ treatmentId: pkgType.treatmentId, name: pkgType.treatment?.name ?? pkgType.name, totalSittings: pkgType.totalSittings, sittingGapDays: pkgType.sittingGapDays, sortOrder: 0 }];
    const saleTotal = saleItems.reduce((s, i) => s + i.totalSittings, 0);

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
          totalSittings: saleTotal,
          isGstTaxable: pkgType.isGstTaxable,
          sittingGapDays: saleItems[0].sittingGapDays,
          sittingsUsed: 0,
          openingSittingsUsed: 0,
          sittingsRemaining: saleTotal,
          items: { create: saleItems },
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

          // Count today's visit as the first sitting when it's clear which treatment
          // was done (matching procedure, or a one-treatment package).
          if (queueEntry.visitId) {
            await this.linkVisitToPurchase(clinicId, queueEntry.visitId, created.id, patient.id, tx, { optional: true });
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

  /**
   * Adds the computed `plan` to each purchase: per-treatment schedules in
   * `plan.items`, and the package-level state / next sitting / expiry.
   */
  async withPlans<T extends { items: any[] } & Record<string, any>>(clinicId: string, purchases: T[]) {
    const holidays = await this.holidaySet(clinicId);
    const today = toLocalDateKey(new Date());
    return purchases.map((p) => ({
      ...p,
      plan: computePurchasePlan(
        {
          ...p,
          items: p.items.map((i: any) => ({ ...i, sittingDates: (i.sittings || []).map((s: any) => s.date) })),
        } as any,
        holidays,
        today,
      ),
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
    let itemUpdate: { id: string; plannedNextSitting: string | null } | null = null;
    if (dto.plannedNextSitting !== undefined) {
      // The next sitting is planned per treatment. A one-treatment package needs no itemId.
      const items = await this.prisma.packagePurchaseItem.findMany({ where: { purchaseId: id }, orderBy: { sortOrder: 'asc' } });
      const item = dto.itemId ? items.find((i) => i.id === dto.itemId) : items.length === 1 ? items[0] : null;
      if (!item) throw new BadRequestException(dto.itemId ? 'That treatment is not part of this package' : 'Choose which treatment to plan');
      itemUpdate = { id: item.id, plannedNextSitting: dto.plannedNextSitting || null };
      changes.push(dto.plannedNextSitting ? `${item.name}: next sitting set to ${dto.plannedNextSitting}` : `${item.name}: back to the regular gap`);
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
      ...(itemUpdate
        ? [this.prisma.packagePurchaseItem.update({ where: { id: itemUpdate.id }, data: { plannedNextSitting: itemUpdate.plannedNextSitting } })]
        : []),
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
    // Each treatment's planned sitting moves by the same number of days.
    const planned = await this.prisma.packagePurchaseItem.findMany({ where: { purchaseId: id, plannedNextSitting: { not: null } } });
    await this.prisma.$transaction([
      this.prisma.packagePurchase.update({
        where: { id },
        data: {
          extendedDays: { increment: dto.days },
          expiryDate: base ? addDays(base, dto.days) : null,
        },
      }),
      ...planned.map((i) =>
        this.prisma.packagePurchaseItem.update({
          where: { id: i.id },
          data: { plannedNextSitting: addDays(i.plannedNextSitting! < today ? today : i.plannedNextSitting!, dto.days) },
        }),
      ),
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
      this.prisma.packagePurchaseItem.updateMany({ where: { purchaseId: id }, data: { plannedNextSitting: null } }),
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

  /** Today's (or the given) queue entry for this package's patient. */
  private async sittingQueueEntry(clinicId: string, patientId: string, queueId?: string) {
    const entry = queueId
      ? await this.prisma.patientQueue.findFirst({ where: { id: queueId, clinicId } })
      : await this.prisma.patientQueue.findFirst({
          where: { clinicId, patientId, queueDate: toLocalDateKey(new Date()), status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
        });
    if (!entry) throw new BadRequestException('Check the patient in first — a sitting is recorded against today\'s visit');
    if (entry.patientId !== patientId) throw new BadRequestException('That visit belongs to another patient');
    if (entry.status === 'CANCELLED') throw new BadRequestException('That visit was cancelled');
    return entry;
  }

  /**
   * Reception records that a sitting was done (the nurse carried out the treatment).
   * Counted on the visit, so a sitting the doctor already counted can't be counted
   * twice. Creates the day-book visit if the patient didn't see the doctor.
   */
  async recordSitting(user: any, purchaseId: string, queueId?: string, itemIds?: string[]) {
    const clinicId = user.clinicId;
    const purchase = await this.prisma.packagePurchase.findFirst({
      where: { id: purchaseId, clinicId },
      include: { packageType: { include: { treatment: { select: { name: true } } } }, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!purchase) throw new NotFoundException('Package not found');
    const entry = await this.sittingQueueEntry(clinicId, purchase.patientId, queueId);

    // Which treatments: as asked, else the ones the nurse was given for this visit.
    let targets = itemIds?.filter(Boolean) ?? [];
    if (!targets.length) {
      const orders = await this.prisma.careOrder.findMany({
        where: { queueId: entry.id, status: { not: 'CANCELLED' }, packageItemId: { not: null } },
        select: { packageItemId: true },
      });
      targets = [...new Set(orders.map((o) => o.packageItemId!))].filter((id) => purchase.items.some((i) => i.id === id));
    }
    if (entry.visitId && targets.length) {
      const already = await this.prisma.packageSitting.findMany({ where: { visitId: entry.visitId, itemId: { in: targets } }, select: { itemId: true } });
      if (already.length === targets.length) throw new BadRequestException('This sitting is already recorded for today\'s visit');
    }

    await this.prisma.$transaction(async (tx) => {
      let visitId = entry.visitId;
      if (!visitId) {
        const firstItem = purchase.items.find((i) => targets.includes(i.id)) ?? purchase.items[0];
        // No consultation happened: the visit goes in the day book under the
        // patient's doctor, at no charge (the package was paid when sold).
        const doctorId = entry.doctorId ?? purchase.packageType?.doctorId ?? (user.role === 'DOCTOR' ? user.id : null);
        if (!doctorId) throw new BadRequestException('Assign a doctor to this patient first (needed for the day book)');
        const visit = await tx.visit.create({
          data: {
            clinicId,
            date: entry.queueDate,
            visitType: entry.careType || 'OPD',
            patientId: entry.patientId,
            doctorId,
            operator: user.name || 'Reception',
            treatmentId: firstItem?.treatmentId ?? purchase.packageType?.treatmentId ?? null,
            treatmentName: firstItem?.name ?? purchase.packageType?.treatment?.name ?? purchase.packageName,
            treatmentPrice: 0,
            isGstTaxable: false,
            status: 'Follow Up',
            remarks: `Package sitting — ${purchase.packageName}`,
          },
        });
        visitId = visit.id;
        await tx.patientQueue.update({ where: { id: entry.id }, data: { visitId, doctorId } });
      }
      const counted = await this.linkVisitToPurchase(clinicId, visitId, purchaseId, purchase.patientId, tx, {
        itemIds: targets.length ? targets : undefined,
        byName: user.name,
      });
      if (!counted.length) throw new BadRequestException('This sitting is already recorded for today\'s visit');
    }, TRANSACTION_OPTIONS);

    return this.findOnePurchase(clinicId, purchaseId);
  }

  /** Undo sittings recorded by mistake for that visit (all treatments, or the ones given). */
  async undoSitting(user: any, purchaseId: string, queueId?: string, note?: string, itemIds?: string[]) {
    const clinicId = user.clinicId;
    const purchase = await this.purchaseOrThrow(clinicId, purchaseId);
    const entry = await this.sittingQueueEntry(clinicId, purchase.patientId, queueId);
    if (!entry.visitId) throw new BadRequestException('No sitting of this package is recorded for that visit');
    const visitId = entry.visitId;

    await this.prisma.$transaction(async (tx) => {
      const removed = await this.unlinkVisitFromPurchase(clinicId, visitId, purchaseId, tx, itemIds);
      if (!removed.length) throw new BadRequestException('No sitting of this package is recorded for that visit');
      await tx.packageAdjustment.create({
        data: {
          purchaseId,
          kind: 'SITTING_UNDONE',
          days: removed.length,
          note: note?.trim() || `Sitting of ${entry.queueDate} undone: ${removed.join(', ')}`,
          byName: user.name || 'Reception',
          byId: user.id,
        },
      });
    }, TRANSACTION_OPTIONS);
    return this.findOnePurchase(clinicId, purchaseId);
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

  /** Recomputes the package totals from its treatment lines and their sittings. */
  async syncSittings(clinicId: string, packagePurchaseId: string, tx?: any) {
    const db = tx ?? this.prisma;
    const purchase = await db.packagePurchase.findFirst({ where: { id: packagePurchaseId, clinicId } });
    if (!purchase) {
      throw new NotFoundException(`Package purchase ID ${packagePurchaseId} not found`);
    }
    const items = await db.packagePurchaseItem.findMany({
      where: { purchaseId: packagePurchaseId },
      include: { _count: { select: { sittings: true } } },
    });
    if (!items.length) return; // Converted on the next start-up.

    const totalSittings = items.reduce((s: number, i: any) => s + i.totalSittings, 0);
    const sittingsUsed = items.reduce((s: number, i: any) => s + itemUsed(i, i._count.sittings), 0);
    await db.packagePurchase.update({
      where: { id: packagePurchaseId },
      data: { totalSittings, sittingsUsed, sittingsRemaining: Math.max(0, totalSittings - sittingsUsed) },
    });
  }

  /**
   * Counts a visit as a sitting of one or more of the package's treatments.
   *
   * Which treatments: `itemIds` if given; otherwise the ones done in the visit (the
   * nurse's package orders, or a procedure matching the treatment), or the only
   * treatment with sittings left. Treatments already counted for this visit are
   * skipped, so re-saving never counts twice. Returns the treatment names counted.
   * With `optional`, an unclear case counts nothing instead of failing.
   */
  async linkVisitToPurchase(
    clinicId: string,
    visitId: string,
    purchaseId: string,
    patientId: string,
    tx: any,
    opts: { itemIds?: string[]; optional?: boolean; byName?: string } = {},
  ): Promise<string[]> {
    const db = tx ?? this.prisma;
    const purchase = await db.packagePurchase.findFirst({
      where: { id: purchaseId, clinicId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { sittings: true } }, sittings: { where: { visitId }, select: { id: true } } },
        },
      },
    });
    if (!purchase) throw new NotFoundException(`Package purchase ID ${purchaseId} not found`);
    if (purchase.patientId !== patientId) {
      throw new BadRequestException(`Package belongs to another patient (${purchase.patientId})`);
    }
    const visit = await db.visit.findFirst({ where: { id: visitId }, select: { date: true, packagePurchaseId: true, treatmentId: true } });
    if (!visit) throw new NotFoundException('Visit not found');

    const items: any[] = purchase.items;
    const remaining = (i: any) => i.totalSittings - itemUsed(i, i._count.sittings);
    const counted = new Set(items.filter((i) => i.sittings.length).map((i) => i.id));

    let targets: any[];
    if (opts.itemIds?.length) {
      const unknown = opts.itemIds.filter((id) => !items.some((i) => i.id === id));
      if (unknown.length) throw new BadRequestException('That treatment is not part of this package');
      targets = items.filter((i) => opts.itemIds!.includes(i.id) && !counted.has(i.id));
    } else {
      const open = items.filter((i) => !counted.has(i.id) && remaining(i) > 0);
      const entry = await db.patientQueue.findFirst({
        where: { visitId },
        include: { careOrders: { where: { status: { not: 'CANCELLED' } }, select: { treatmentId: true, packageItemId: true } } },
      });
      const doneTreatments = new Set([visit.treatmentId, ...(entry?.careOrders ?? []).map((o: any) => o.treatmentId)].filter(Boolean));
      const doneItems = new Set((entry?.careOrders ?? []).map((o: any) => o.packageItemId).filter(Boolean));
      targets = open.filter((i) => doneItems.has(i.id) || (i.treatmentId && doneTreatments.has(i.treatmentId)));
      if (!targets.length && open.length === 1) targets = open;
      if (!targets.length) {
        if (counted.size || opts.optional) return []; // Already counted, or unclear and allowed to skip.
        throw new BadRequestException(
          open.length
            ? `${purchase.packageName} has several treatments — choose which were done (Packages → Manage plan → Record today's sitting)`
            : `${purchase.packageName} has no sittings left`,
        );
      }
    }
    if (!targets.length) return [];

    // An expired or lapsed package can't take a new sitting.
    const blocked = sittingBlockReason(purchase, visit.date || toLocalDateKey(new Date()));
    if (blocked) {
      if (opts.optional) return [];
      throw new BadRequestException(blocked);
    }
    const full = targets.find((i) => remaining(i) <= 0);
    if (full) throw new BadRequestException(`${full.name} has no sittings left in ${purchase.packageName}`);

    await db.packageSitting.createMany({
      data: targets.map((i) => ({ purchaseId, itemId: i.id, visitId, date: visit.date, byName: opts.byName ?? null })),
    });
    // The doctor's planned date was for this sitting; the next one is planned afresh.
    await db.packagePurchaseItem.updateMany({
      where: { id: { in: targets.map((i) => i.id) }, plannedNextSitting: { not: null } },
      data: { plannedNextSitting: null },
    });
    if (visit.packagePurchaseId !== purchaseId) {
      await db.visit.update({ where: { id: visitId }, data: { packagePurchaseId: purchaseId } });
    }
    await this.syncSittings(clinicId, purchaseId, db);
    return targets.map((i) => i.name);
  }

  /** Stops counting a visit as sittings of this package (all treatments, or the given ones). */
  async unlinkVisitFromPurchase(clinicId: string, visitId: string, purchaseId: string, tx?: any, itemIds?: string[]): Promise<string[]> {
    const db = tx ?? this.prisma;
    const where: any = { visitId, purchaseId, ...(itemIds?.length ? { itemId: { in: itemIds } } : {}) };
    const rows = await db.packageSitting.findMany({ where, include: { item: { select: { name: true } } } });
    if (rows.length) await db.packageSitting.deleteMany({ where });
    const left = await db.packageSitting.count({ where: { visitId, purchaseId } });
    if (!left) {
      await db.visit.updateMany({ where: { id: visitId, packagePurchaseId: purchaseId }, data: { packagePurchaseId: null } });
    }
    await this.syncSittings(clinicId, purchaseId, db);
    return rows.map((r: any) => r.item.name);
  }
}
