import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toLocalDateKey } from '../common/date.helper';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';

export const DIARY_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DIARY_MAX_PHOTOS = 6;

const ENTRY_SELECT = {
  id: true,
  patientId: true,
  queueId: true,
  visitDate: true,
  purchaseId: true,
  purchaseItemId: true,
  packageName: true,
  treatmentName: true,
  sittingNumber: true,
  totalSittings: true,
  progress: true,
  notes: true,
  reaction: true,
  createdAt: true,
  createdById: true,
  createdBy: { select: { id: true, name: true, role: true } },
  // Photo bytes are fetched one by one; the list only carries their ids.
  photos: { select: { id: true, sizeBytes: true }, orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class PatientDiaryService {
  constructor(private readonly prisma: PrismaService) {}

  private async patientOrThrow(clinicId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, clinicId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  /** Sittings of a treatment line done before `date`, so today's is number +1. */
  private async sittingNumberOn(item: { id: string; openingSittingsUsed: number | null; totalSittings: number }, date: string) {
    const before = await this.prisma.packageSitting.count({ where: { itemId: item.id, date: { lt: date } } });
    return Math.min(item.totalSittings, Math.max(0, item.openingSittingsUsed ?? 0) + before + 1);
  }

  async findAll(clinicId: string, patientId: string, purchaseId?: string) {
    await this.patientOrThrow(clinicId, patientId);
    return this.prisma.patientDiaryEntry.findMany({
      where: { clinicId, patientId, ...(purchaseId ? { purchaseId } : {}) },
      select: ENTRY_SELECT,
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * What the entry form offers: the patient's package treatments (today's sitting
   * ones first) and any procedure ordered at today's visit.
   */
  async context(clinicId: string, patientId: string, queueId?: string) {
    await this.patientOrThrow(clinicId, patientId);
    const queue = queueId
      ? await this.prisma.patientQueue.findFirst({
          where: { id: queueId, clinicId, patientId },
          select: { id: true, queueDate: true, careOrders: { where: { status: { not: 'CANCELLED' }, orderType: 'TREATMENT' }, select: { packageItemId: true, description: true } } },
        })
      : null;
    const date = queue?.queueDate ?? toLocalDateKey(new Date());
    const todaysItemIds = new Set((queue?.careOrders ?? []).map((o) => o.packageItemId).filter(Boolean) as string[]);

    const purchases = await this.prisma.packagePurchase.findMany({
      where: { clinicId, patientId },
      select: {
        id: true, packageName: true, lapsedAt: true, sittingsRemaining: true,
        items: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, totalSittings: true, openingSittingsUsed: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const treatments: {
      purchaseItemId: string; purchaseId: string; packageName: string; treatmentName: string;
      sittingNumber: number; totalSittings: number; today: boolean; active: boolean;
    }[] = [];
    for (const p of purchases) {
      for (const item of p.items) {
        treatments.push({
          purchaseItemId: item.id,
          purchaseId: p.id,
          packageName: p.packageName,
          treatmentName: item.name,
          sittingNumber: await this.sittingNumberOn(item, date),
          totalSittings: item.totalSittings,
          today: todaysItemIds.has(item.id),
          active: !p.lapsedAt && p.sittingsRemaining > 0,
        });
      }
    }
    treatments.sort((a, b) => Number(b.today) - Number(a.today) || Number(b.active) - Number(a.active));

    const procedures = [...new Set((queue?.careOrders ?? []).filter((o) => !o.packageItemId).map((o) => o.description))];
    return { date, treatments, procedures };
  }

  async create(user: any, dto: CreateDiaryEntryDto, files: Express.Multer.File[] = []) {
    const clinicId = user.clinicId;
    await this.patientOrThrow(clinicId, dto.patientId);
    if (files.length > DIARY_MAX_PHOTOS) throw new BadRequestException(`Up to ${DIARY_MAX_PHOTOS} photos per entry`);
    for (const f of files) {
      if (!DIARY_PHOTO_TYPES.includes(f.mimetype)) throw new BadRequestException('Photos must be JPEG, PNG or WEBP images');
    }

    let visitDate = toLocalDateKey(new Date());
    let queueId: string | null = null;
    if (dto.queueId) {
      const q = await this.prisma.patientQueue.findFirst({ where: { id: dto.queueId, clinicId }, select: { id: true, patientId: true, queueDate: true } });
      if (!q) throw new NotFoundException('Visit not found');
      if (q.patientId !== dto.patientId) throw new BadRequestException('That visit belongs to another patient');
      queueId = q.id;
      visitDate = q.queueDate;
    }

    let line: { purchaseId: string; purchaseItemId: string; packageName: string; treatmentName: string; sittingNumber: number; totalSittings: number } | null = null;
    if (dto.purchaseItemId) {
      const item = await this.prisma.packagePurchaseItem.findFirst({
        where: { id: dto.purchaseItemId, purchase: { clinicId, patientId: dto.patientId } },
        select: { id: true, name: true, totalSittings: true, openingSittingsUsed: true, purchase: { select: { id: true, packageName: true } } },
      });
      if (!item) throw new BadRequestException('That treatment is not part of this patient\'s packages');
      line = {
        purchaseId: item.purchase.id,
        purchaseItemId: item.id,
        packageName: item.purchase.packageName,
        treatmentName: item.name,
        sittingNumber: await this.sittingNumberOn(item, visitDate),
        totalSittings: item.totalSittings,
      };
    }

    const entry = await this.prisma.patientDiaryEntry.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        queueId,
        visitDate,
        purchaseId: line?.purchaseId ?? null,
        purchaseItemId: line?.purchaseItemId ?? null,
        packageName: line?.packageName ?? null,
        treatmentName: line?.treatmentName ?? (dto.treatmentName?.trim() || null),
        sittingNumber: line?.sittingNumber ?? null,
        totalSittings: line?.totalSittings ?? null,
        progress: dto.progress || null,
        notes: dto.notes.trim(),
        reaction: dto.reaction?.trim() || null,
        createdById: user.id,
        photos: {
          create: files.map((f) => ({ mimeType: f.mimetype, data: f.buffer, sizeBytes: f.size })),
        },
      },
      select: ENTRY_SELECT,
    });
    return entry;
  }

  async photo(clinicId: string, id: string) {
    const photo = await this.prisma.patientDiaryPhoto.findFirst({
      where: { id, entry: { clinicId } },
      select: { mimeType: true, data: true },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    return photo;
  }

  /** The author can remove their entry on the same day; the owner/admin any time. */
  async remove(user: any, id: string) {
    const entry = await this.prisma.patientDiaryEntry.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!entry) throw new NotFoundException('Diary entry not found');
    const isAdmin = ['MASTER', 'SUPER_ADMIN'].includes(user.role);
    const ownToday = entry.createdById === user.id && toLocalDateKey(entry.createdAt) === toLocalDateKey(new Date());
    if (!isAdmin && !ownToday) {
      throw new ForbiddenException('Only the person who wrote it can delete it, on the same day');
    }
    await this.prisma.patientDiaryEntry.delete({ where: { id } });
    return { id };
  }
}
