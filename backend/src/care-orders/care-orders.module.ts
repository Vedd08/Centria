import { Module } from '@nestjs/common';
import { CareOrdersService } from './care-orders.service';
import { CareOrdersController } from './care-orders.controller';

@Module({
  controllers: [CareOrdersController],
  providers: [CareOrdersService],
  exports: [CareOrdersService],
})
export class CareOrdersModule {}
