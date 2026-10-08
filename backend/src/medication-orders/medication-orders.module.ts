import { Module } from '@nestjs/common';
import { MedicationOrdersService } from './medication-orders.service';
import { MedicationOrdersController } from './medication-orders.controller';

@Module({
  controllers: [MedicationOrdersController],
  providers: [MedicationOrdersService],
  exports: [MedicationOrdersService],
})
export class MedicationOrdersModule {}
