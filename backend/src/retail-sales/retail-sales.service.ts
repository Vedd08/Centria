import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateRetailSaleDto } from './dto/create-retail-sale.dto';
import { TRANSACTION_OPTIONS } from '../prisma/transaction-options';
import { decrementStock } from '../common/decrement-stock';

@Injectable()
export class RetailSalesService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  async create(clinicId: string, dto: CreateRetailSaleDto, requestingUser: any) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('A retail sale must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Calculate totals and check existence
      let subTotal = 0;
      let taxableValue = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      
      const lines = [];

      for (const item of dto.items) {
        const medicine = await tx.medicine.findFirst({ where: { id: item.medicineId, clinicId } });
        if (!medicine) throw new NotFoundException(`Medicine ID ${item.medicineId} not found`);
        if (!medicine.isActive) throw new BadRequestException(`'${medicine.name}' is discontinued and cannot be sold`);

        const amount = item.quantity * item.unitPrice;
        subTotal += amount;
        
        if (medicine.isGstTaxable) {
          taxableValue += amount;
          const rate = medicine.taxRate ? Number(medicine.taxRate) : 18;
          totalCgst += amount * ((rate / 2) / 100);
          totalSgst += amount * ((rate / 2) / 100);
        }

        // 2. Deduct stock safely (throws if insufficient)
        const { newQty, batchDeductions } = await decrementStock(tx, clinicId, medicine, item.quantity);

        // 3. Record stock movement
        await tx.stockMovement.create({
          data: {
            clinicId,
            medicineId: medicine.id,
            delta: -item.quantity,
            reason: 'Retail Sale',
            newQty,
            performedById: requestingUser.id,
          },
        });

        lines.push({
          medicineId: medicine.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: amount,
          batchDeductions,
        });
      }

      const cgst = Math.round(totalCgst * 100) / 100;
      const sgst = Math.round(totalSgst * 100) / 100;
      const grandTotal = Math.round((subTotal + cgst + sgst) * 100) / 100;

      // 4. Create RetailSale Record
      const retailSale = await tx.retailSale.create({
        data: {
          clinicId,
          customerName: dto.customerName || 'Walk-in Customer',
          customerPhone: dto.customerPhone || null,
          totalAmount: grandTotal,
          paymentMethod: dto.paymentMethod,
          paymentRef: dto.paymentRef || null,
        },
      });

      for (const line of lines) {
        const saleItem = await tx.retailSaleItem.create({
          data: {
            retailSaleId: retailSale.id,
            medicineId: line.medicineId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
          },
        });

        if (line.batchDeductions && line.batchDeductions.length > 0) {
          await tx.batchDispenseRecord.createMany({
            data: line.batchDeductions.map((bd: any) => ({
              batchId: bd.batchId,
              quantity: bd.quantity,
              retailSaleItemId: saleItem.id,
            })),
          });
        }
      }

      // 5. Generate Invoice
      // We call invoicesService.create using the standard API, but pass it retailSaleId
      // and explicit exact tax numbers.
      // However, we are inside a transaction right now! invoicesService.create creates its own transaction.
      // Let's create the invoice manually here to keep it atomic, or we can just call the service if we are okay with it being outside the transaction.
      // Wait, it's better to just build the invoice inside this transaction to guarantee atomicity.
      return { retailSaleId: retailSale.id, cgst, sgst, taxableValue };
    }, TRANSACTION_OPTIONS)
    .then(async (result) => {
      // 6. Generate invoice OUTSIDE the stock transaction to avoid nested transaction lock issues.
      const invoice = await this.invoicesService.create(clinicId, {
        retailSaleId: result.retailSaleId,
        taxableValue: result.taxableValue,
        cgstOverride: result.cgst,
        sgstOverride: result.sgst,
        paymentMethod: dto.paymentMethod as 'cash' | 'bank',
        paymentRef: dto.paymentRef,
      });

      return invoice;
    });
  }
}
