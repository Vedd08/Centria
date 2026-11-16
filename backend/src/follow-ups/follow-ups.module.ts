import { Module } from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service';
import { SittingFollowUpsService } from './sitting-follow-ups.service';
import { FollowUpsController } from './follow-ups.controller';

@Module({
  controllers: [FollowUpsController],
  providers: [FollowUpsService, SittingFollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
