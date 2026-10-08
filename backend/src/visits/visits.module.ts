import { Module } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { CommissionsModule } from '../commissions/commissions.module';
import { PackagesModule } from '../packages/packages.module';

@Module({
  imports: [CommissionsModule, PackagesModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}