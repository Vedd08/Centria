import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT', 'DOCTOR')
  @Get('revenue')
  getRevenue(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getRevenueStats(user.clinicId, from, to);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Get('patients')
  getPatients(@CurrentUser() user: any) {
    return this.analyticsService.getPatientStats(user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Get('treatments')
  getTreatments(@CurrentUser() user: any) {
    return this.analyticsService.getTreatmentStats(user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT')
  @Get('collections')
  getCollections(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getCollections(user.clinicId, from, to);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT')
  @Get('doctors')
  getDoctorPerformance(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getDoctorPerformance(user.clinicId, from, to);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'ACCOUNT', 'PHARMACY')
  @Get('pharmacy')
  getPharmacy(@CurrentUser() user: any, @Query('days') days?: string) {
    const window = Number(days);
    return this.analyticsService.getPharmacyStats(
      user.clinicId,
      Number.isFinite(window) && window > 0 ? Math.min(window, 365) : 90,
    );
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RECEPTION')
  @Get('patient-flow')
  getPatientFlow(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getPatientFlow(user.clinicId, from, to);
  }
}
