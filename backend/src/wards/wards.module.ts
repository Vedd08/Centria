import { Module } from '@nestjs/common';
import { WardsService } from './wards.service';
import { WardsController } from './wards.controller';

@Module({
  controllers: [WardsController],
  providers: [WardsService],
  exports: [WardsService],
})
export class WardsModule {}
