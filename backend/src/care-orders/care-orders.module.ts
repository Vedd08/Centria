import { Module } from '@nestjs/common';
import { CareOrdersService } from './care-orders.service';
import { CareOrdersController } from './care-orders.controller';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [CareOrdersController],
  providers: [CareOrdersService],
  exports: [CareOrdersService],
})
export class CareOrdersModule {}
