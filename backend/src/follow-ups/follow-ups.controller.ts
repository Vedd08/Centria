import {
  Controller, Get, Post, Body, Query, UseGuards,
} from '@nestjs/common';
import { FollowUpsService, FollowUpKind, CallOutcome } from './follow-ups.service';
import { LogCallDto } from './dto/log-call.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const READ_ROLES = ['RECEPTION', 'RM', 'MASTER', 'SUPER_ADMIN'] as const;
const CALL_ROLES = ['RECEPTION', 'RM', 'MASTER', 'SUPER_ADMIN'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Roles(...READ_ROLES)
  @Get()
  getFollowUps(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.followUpsService.getFollowUps(user.clinicId, { from, to });
  }

  @Roles(...READ_ROLES)
  @Get('summary')
  getSummary(@CurrentUser() user: any) {
    return this.followUpsService.getSummary(user.clinicId);
  }

  @Roles(...CALL_ROLES)
  @Post('calls')
  logCall(
    @CurrentUser() user: any,
    @Body() body: LogCallDto,
  ) {
    return this.followUpsService.logCall(user.clinicId, user.id, body);
  }
}
