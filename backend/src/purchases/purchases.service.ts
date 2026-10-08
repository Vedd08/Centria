import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(clinicId: string, dto: CreatePurchaseDto, requestingUser: any) {
    const igst = round2(dto.igst ?? 0);
    const cgst = round2(dto.cgst ?? 0);
    const sgst = round2(dto.sgst ?? 0);

    // A supply is either inter-state (IGST) or intra-state (CGST + SGST) — never both.
    // Accepting both would overstate the input tax credit claimable on this invoice.
    if (igst > 0 && (cgst > 0 || sgst > 0)) {
      throw new BadRequestException(
        'A purchase carries either IGST (inter-state) or CGST + SGST (intra-state), not both',
      );
    }

    if (igst === 0 && cgst !== sgst) {
      throw new BadRequestException(
        `On an intra-state purchase CGST and SGST must be equal (got CGST ${cgst}, SGST ${sgst})`,
      );
    }

    const recordedById = requestingUser?.id;
    if (!recordedById) {
      throw new BadRequestException('Recording user could not be determined');
    }

    // Derived server-side so the ledger total always reconciles with its components.
    const totalValue = round2(dto.taxableValue + igst + cgst + sgst);

    return this.prisma.purchase.create({
      data: {
        clinicId,
        vendorName: dto.vendorName.trim(),
        vendorGstn: dto.vendorGstn.trim().toUpperCase(),
        invoiceNumber: dto.invoiceNumber.trim(),
        invoiceDate: dto.invoiceDate,
        itemDescription: dto.itemDescription.trim(),
        inputClassification: dto.inputClassification,
        itcEligibility: dto.itcEligibility,
        taxableValue: round2(dto.taxableValue),
        igst,
        cgst,
        sgst,
        totalValue,
        recordedById,
      },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async findAll(clinicId: string, search?: string) {
    const term = search?.trim();
    return this.prisma.purchase.findMany({
      where: {
        clinicId,
        ...(term
          ? {
              OR: [
                { vendorName: { contains: term } },
                { vendorGstn: { contains: term } },
                { invoiceNumber: { contains: term } },
                { itemDescription: { contains: term } },
              ],
            }
          : {}),
      },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, clinicId },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    });
    if (!purchase) {
      throw new NotFoundException(`Purchase ID ${id} not found`);
    }
    return purchase;
  }

  /**
   * Input-tax-credit summary for a GST return period. "Mixed Use" inputs are reported
   * separately from "Full" because they need apportionment before being claimed, and
   * "Ineligible" tax is excluded from the claimable figure entirely.
   */
  async itcSummary(clinicId: string, fromDate?: string, toDate?: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        clinicId,
        ...(fromDate || toDate
          ? {
              invoiceDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { invoiceDate: 'asc' },
    });

    const bucket = () => ({ taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0, count: 0 });
    const byEligibility: Record<string, ReturnType<typeof bucket>> = {
      Full: bucket(),
      'Mixed Use': bucket(),
      Ineligible: bucket(),
    };
    const byClassification: Record<string, ReturnType<typeof bucket>> = {};

    for (const p of purchases) {
      const igst = Number(p.igst);
      const cgst = Number(p.cgst);
      const sgst = Number(p.sgst);
      const taxableValue = Number(p.taxableValue);
      const totalTax = igst + cgst + sgst;

      const target = byEligibility[p.itcEligibility] ?? (byEligibility[p.itcEligibility] = bucket());
      target.taxableValue = round2(target.taxableValue + taxableValue);
      target.igst = round2(target.igst + igst);
      target.cgst = round2(target.cgst + cgst);
      target.sgst = round2(target.sgst + sgst);
      target.totalTax = round2(target.totalTax + totalTax);
      target.count += 1;

      const cls = byClassification[p.inputClassification] ?? (byClassification[p.inputClassification] = bucket());
      cls.taxableValue = round2(cls.taxableValue + taxableValue);
      cls.igst = round2(cls.igst + igst);
      cls.cgst = round2(cls.cgst + cgst);
      cls.sgst = round2(cls.sgst + sgst);
      cls.totalTax = round2(cls.totalTax + totalTax);
      cls.count += 1;
    }

    return {
      period: { fromDate: fromDate ?? null, toDate: toDate ?? null },
      purchaseCount: purchases.length,
      fullyClaimableTax: byEligibility.Full.totalTax,
      apportionableTax: byEligibility['Mixed Use'].totalTax,
      ineligibleTax: byEligibility.Ineligible.totalTax,
      byEligibility,
      byClassification,
    };
  }
}
