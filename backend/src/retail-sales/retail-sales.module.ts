import { Module } from '@nestjs/common';
import { RetailSalesService } from './retail-sales.service';
import { RetailSalesController } from './retail-sales.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [RetailSalesController],
  providers: [RetailSalesService],
})
export class RetailSalesModule {}
