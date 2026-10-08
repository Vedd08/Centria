import { Injectable, NotFoundException } from '@nestjs/common';
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

  async createPackageType(clinicId: string, dto: CreatePackageTypeDto) {
    return this.prisma.packageType.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        description: dto.description,
        price: dto.price,
        totalSittings: dto.totalSittings,
        isGstTaxable: dto.isGstTaxable ?? true,
      },
    });
  }

  async findAllPackageTypes(clinicId: string) {
    return this.prisma.packageType.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
    });
  }

  async updatePackageType(clinicId: string, id: string, dto: CreatePackageTypeDto) {
    const pkg = await this.prisma.packageType.findFirst({ where: { id, clinicId } });
    if (!pkg) throw new NotFoundException(`Package type ID ${id} not found in this clinic`);

    return this.prisma.packageType.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description,
        price: dto.price,
        totalSittings: dto.totalSittings,
        isGstTaxable: dto.isGstTaxable ?? true,
      },
    });
  }

  async removePackageType(clinicId: string, id: string) {
    const result = await this.prisma.packageType.deleteMany({ where: { id, clinicId } });
    if (result.count === 0) {
      throw new NotFoundException(`Package type ID ${id} not found in this clinic`);
    }
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

    const todayDate = new Date().toISOString().split('T')[0];
    const amountPaid = dto.amountPaid !== undefined ? dto.amountPaid : pkgType.price;

    // 1. Save PackagePurchase record
    const purchase = await this.prisma.packagePurchase.create({
      data: {
        clinicId,
        patientId: patient.id,
        packageTypeId: pkgType.id,
        packageName: pkgType.name,
        purchaseDate: dto.purchaseDate || todayDate,
        amountPaid,
        sittingsUsed: 0,
        sittingsRemaining: pkgType.totalSittings,
      },
      include: {
        patient: true,
        packageType: true,
      },
    });

    // 2. AUTOMATIC TAX INVOICE GENERATION AT PACKAGE SALE TIME:
    // Package purchase is the GST tax point (taxableValue + 9% CGST + 9% SGST)
    await this.invoicesService.create(clinicId, {
      packagePurchaseId: purchase.id,
      taxableValue: Number(amountPaid),
      paymentMethod: dto.paymentMethod || 'bank',
      paymentRef: dto.paymentRef || 'Package Sale Purchase',
    });

    return purchase;
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
}
