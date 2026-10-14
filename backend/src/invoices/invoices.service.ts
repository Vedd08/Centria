import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { textContains } from '../common/text-search';
import { cleanPaymentDetails, serializePaymentDetails, toLedgerMethod } from '../common/payment-details';

interface InvoiceFilters {
  search?: string;
  from?: string;
  to?: string;
  reconciled?: string;
}

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Numbers invoices per financial year (INV-2026-0001, INV-2026-0002, ...).
   *
   * The sequence is derived from the highest number already issued *for this year*
   * rather than a global row count, so it neither restarts nor skips ahead when the
   * year rolls over or when an invoice is deleted.
   */
  private async generateNextInvoiceNumber(clinicId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const latest = await this.prisma.invoice.findFirst({
      where: { clinicId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let counter = 1;
    if (latest) {
      const parsed = parseInt(latest.invoiceNumber.slice(prefix.length), 10);
      if (!Number.isNaN(parsed)) {
        counter = parsed + 1;
      }
    }

    let candidate = `${prefix}${counter.toString().padStart(4, '0')}`;
    let existing = await this.prisma.invoice.findFirst({ where: { clinicId, invoiceNumber: candidate } });
    while (existing) {
      counter++;
      candidate = `${prefix}${counter.toString().padStart(4, '0')}`;
      existing = await this.prisma.invoice.findFirst({ where: { clinicId, invoiceNumber: candidate } });
    }

    return candidate;
  }

  /**
   * BUSINESS RULE 4 ENGINE:
   * Splits GST into CGST (9%) + SGST (9%) (intra-state) computed off treatment taxability.
   * If a Visit is linked to an active PackagePurchase, taxableValue is ₹0.00 (already settled at package purchase time).
   */
  async create(
    clinicId: string,
    dto: CreateInvoiceDto & {
      cgstOverride?: number;
      sgstOverride?: number;
      /** Set by callers that sold below list price (package sales) — printed on the invoice. */
      listPrice?: number;
      discountAmount?: number;
      discountReason?: string | null;
    },
  ) {
    if (!dto.visitId && !dto.packagePurchaseId && !dto.queueId && !dto.retailSaleId) {
      throw new BadRequestException('An invoice must be linked to a Visit, a Package Purchase, a Queue Entry, or a Retail Sale');
    }

    let patientName = '';
    let patientUhid = '';
    let itemTitle = '';
    let isGstTaxable = true;
    let isCoveredByPackage = false;
    let baseTaxRate = 18.0;

    if (dto.visitId) {
      const alreadyBilled = await this.prisma.invoice.findFirst({
        where: { clinicId, visitId: dto.visitId },
        select: { invoiceNumber: true },
      });
      if (alreadyBilled) {
        throw new ConflictException(
          `This visit has already been billed on invoice ${alreadyBilled.invoiceNumber}. Cancel that invoice before re-issuing.`,
        );
      }

      const visit = await this.prisma.visit.findFirst({
        where: { id: dto.visitId, clinicId },
        include: { patient: true, treatment: true, packagePurchase: true, queueEntry: { select: { tokenNumber: true, bills: { select: { kind: true, billNumber: true } } } } },
      });
      if (!visit) throw new NotFoundException(`Visit ID ${dto.visitId} not found`);

      // A visit that came through the queue is paid on its itemised Patient Bill
      // (consultation, treatment, services). Billing it here as well charged it twice,
      // or as ₹0 when the visit was a package sitting.
      if (visit.queueEntry) {
        const pb = visit.queueEntry.bills.find((b) => b.kind === 'PATIENT');
        throw new ConflictException(
          `This visit was checked in through the queue (token ${visit.queueEntry.tokenNumber}). Take payment on its Patient Bill${pb ? ` ${pb.billNumber}` : ''} under "Today's patient bills".`,
        );
      }

      patientName = visit.patient.name;
      patientUhid = visit.patient.uhid;
      itemTitle = visit.treatmentName;
      isGstTaxable = visit.isGstTaxable;
      if (visit.treatment && visit.treatment.taxRate !== null) {
        baseTaxRate = Number(visit.treatment.taxRate);
      }

      if (visit.packagePurchaseId) {
        isCoveredByPackage = true;
      }
    } else if (dto.packagePurchaseId) {
      const pkg = await this.prisma.packagePurchase.findFirst({
        where: { id: dto.packagePurchaseId, clinicId },
        include: { patient: true, packageType: true },
      });
      if (!pkg) throw new NotFoundException(`Package Purchase ID ${dto.packagePurchaseId} not found`);

      patientName = pkg.patient.name;
      patientUhid = pkg.patient.uhid;
      itemTitle = pkg.packageName;
      isGstTaxable = pkg.packageType ? pkg.packageType.isGstTaxable : true;
    } else if (dto.queueId) {
      const queue = await this.prisma.patientQueue.findFirst({
        where: { id: dto.queueId, clinicId },
        include: { patient: true },
      });
      if (!queue) throw new NotFoundException(`Queue ID ${dto.queueId} not found`);
      
      patientName = queue.patient.name;
      patientUhid = queue.patient.uhid;
      itemTitle = 'Pharmacy Bill';
      isGstTaxable = true; // Pharmacy bills calculate their own itemized taxes
      baseTaxRate = 0; // Mixed rates, so we set base rate to 0 and use overrides
    } else if (dto.retailSaleId) {
      const sale = await this.prisma.retailSale.findFirst({
        where: { id: dto.retailSaleId, clinicId }
      });
      if (!sale) throw new NotFoundException(`Retail Sale ID ${dto.retailSaleId} not found`);
      patientName = sale.customerName || 'Walk-in Customer';
      patientUhid = 'RETAIL';
      itemTitle = 'Retail Pharmacy Sale';
      isGstTaxable = true;
      baseTaxRate = 0;
    }

    const taxableValue = isCoveredByPackage ? 0.0 : Math.round(dto.taxableValue * 100) / 100;
    let cgstRate = 0.0;
    let sgstRate = 0.0;
    let cgst = 0.0;
    let sgst = 0.0;

    if (isGstTaxable && !isCoveredByPackage) {
      if (dto.cgstOverride !== undefined && dto.sgstOverride !== undefined) {
        // Use precalculated exact tax (used by Pharmacy bills for mixed-tax items)
        cgst = Math.round(dto.cgstOverride * 100) / 100;
        sgst = Math.round(dto.sgstOverride * 100) / 100;
      } else {
        cgstRate = baseTaxRate / 2;
        sgstRate = baseTaxRate / 2;
        cgst = Math.round(taxableValue * (cgstRate / 100) * 100) / 100;
        sgst = Math.round(taxableValue * (sgstRate / 100) * 100) / 100;
      }
    }

    const totalAmount = Math.round((taxableValue + cgst + sgst) * 100) / 100;

    // A specific mode (cash/online/card/UPI) carries its own printed details; the
    // ledger still only needs to know whether the money went to the till or the bank.
    const paymentDetails = dto.paymentMode ? cleanPaymentDetails(dto.paymentMode, dto.paymentDetails) : null;
    const paymentMethod = dto.paymentMode ? toLedgerMethod(dto.paymentMode) : dto.paymentMethod!;
    const paymentRef = dto.paymentRef || (paymentDetails?.transactionId as string | undefined);

    let retries = 3;
    while (retries > 0) {
      try {
        const invoiceNumber = await this.generateNextInvoiceNumber(clinicId);

        return await this.prisma.invoice.create({
          data: {
            clinicId,
            invoiceNumber,
            visitId: dto.visitId || null,
            packagePurchaseId: dto.packagePurchaseId || null,
            retailSaleId: dto.retailSaleId || null,
            patientName,
            patientUhid,
            itemTitle: isCoveredByPackage ? `${itemTitle} (Package Session Redemption)` : itemTitle,
            isGstTaxable,
            listPrice: dto.listPrice ?? null,
            discountAmount: dto.discountAmount ?? 0,
            discountReason: dto.discountReason ?? null,
            taxableValue,
            cgstRate,
            sgstRate,
            cgst,
            sgst,
            totalAmount,
            paymentMethod: isCoveredByPackage ? 'Pre-paid Package' : paymentMethod,
            paymentRef: paymentRef || (isCoveredByPackage ? 'Covered under Package Invoice' : null),
            paymentMode: isCoveredByPackage ? null : (dto.paymentMode ?? null),
            paymentDetails: isCoveredByPackage ? null : serializePaymentDetails(paymentDetails),
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          retries--;
          if (retries === 0) throw error;
        } else {
          throw error;
        }
      }
    }
  }

  async findAll(clinicId: string, filters?: InvoiceFilters, page: number = 1, pageSize: number = 20) {
    const where: Prisma.InvoiceWhereInput = { clinicId };

    if (filters) {
      if (filters.search) {
        const term = filters.search.trim();
        where.OR = [
          { invoiceNumber: textContains(term) },
          { patientName: textContains(term) },
          { patientUhid: textContains(term) },
          { itemTitle: textContains(term) },
          { paymentRef: textContains(term) },
        ];
      }

      if (filters.from || filters.to) {
        where.issuedAt = {} as any;
        if (filters.from) (where.issuedAt as any).gte = new Date(filters.from);
        if (filters.to) (where.issuedAt as any).lte = new Date(filters.to + 'T23:59:59.999Z');
      }

      if (filters.reconciled === 'true') where.reconciled = true;
      else if (filters.reconciled === 'false') where.reconciled = false;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(clinicId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, clinicId },
      include: {
        visit: { include: { patient: true, doctor: true, rm: true, treatment: true } },
        packagePurchase: { include: { patient: true, packageType: true } },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice ID ${id} not found`);
    return invoice;
  }

  async toggleReconcile(clinicId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, clinicId } });
    if (!invoice) throw new NotFoundException(`Invoice ID ${id} not found`);

    const newReconciled = !invoice.reconciled;
    return this.prisma.invoice.update({
      where: { id },
      data: {
        reconciled: newReconciled,
        reconciledAt: newReconciled ? new Date() : null,
        reconciliationNotes: newReconciled ? 'Manually reconciled' : null,
      },
    });
  }

  async remove(clinicId: string, id: string) {
    const result = await this.prisma.invoice.deleteMany({ where: { id, clinicId } });
    if (result.count === 0) {
      throw new NotFoundException(`Invoice ID ${id} not found`);
    }
    return { message: 'Invoice deleted successfully' };
  }
}
