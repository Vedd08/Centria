import { Module } from '@nestjs/common';
import { RmService } from './rm.service';
import { RmController } from './rm.controller';
import { CommissionsModule } from '../commissions/commissions.module';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';

@Module({
  imports: [CommissionsModule, FollowUpsModule],
  controllers: [RmController],
  providers: [RmService],
})
export class RmModule {}
