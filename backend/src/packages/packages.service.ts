import { toLocalDateKey } from '../common/date.helper';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageTypeDto } from './dto/create-package-type.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { InvoicesService } from '../invoices/invoices.service';

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

  async purchasePackage(clinicId: string, dto: PurchasePackageDto) {
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
    const amountPaid = dto.amountPaid !== undefined ? dto.amountPaid : pkgType.price;

    const purchase = await this.prisma.$transaction(async (tx) => {
      // 1. Save PackagePurchase record
      const created = await tx.packagePurchase.create({
        data: {
          clinicId,
          patientId: patient.id,
          packageTypeId: pkgType.id,
          packageName: pkgType.name,
          purchaseDate: dto.purchaseDate || todayDate,
          amountPaid,
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
    return this.prisma.packagePurchase.findMany({
      where: {
        clinicId,
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: true,
        packageType: true,
        invoices: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActivePurchasesByPatient(clinicId: string, patientId: string) {
    return this.prisma.packagePurchase.findMany({
      where: {
        clinicId,
        patientId,
        sittingsRemaining: { gt: 0 },
      },
      include: {
        packageType: true,
        invoices: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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

    // Re-sync sittings
    await this.syncSittings(clinicId, purchaseId, db);
  }
}
