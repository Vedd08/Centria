import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'ACCOUNT')
  @Get('rules')
  findAllRules(@CurrentUser() user: any) {
    return this.commissionsService.findAllRules(user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Post('rules')
  upsertRule(@CurrentUser() user: any, @Body() dto: UpdateCommissionRuleDto) {
    return this.commissionsService.upsertRule(user.clinicId, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'ACCOUNT')
  @Get('records')
  findAllRecords(@CurrentUser() user: any, @Query('role') role?: string) {
    return this.commissionsService.findAllRecords(user.clinicId, role);
  }
}
