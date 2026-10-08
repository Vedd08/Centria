import { Module } from '@nestjs/common';
import { RmService } from './rm.service';
import { RmController } from './rm.controller';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [CommissionsModule],
  controllers: [RmController],
  providers: [RmService],
})
export class RmModule {}
