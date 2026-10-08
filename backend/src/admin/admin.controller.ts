import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Management reporting — the owner's view of the whole clinic. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'MASTER')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: any) {
    return this.adminService.getOverview(user.clinicId);
  }

  @Get('doctors')
  getDoctorRecords(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.getDoctorRecords(user.clinicId, from, to);
  }

  @Get('staff')
  getStaffRecords(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.getStaffRecords(user.clinicId, from, to);
  }

  @Get('pharmacy')
  getPharmacyRecords(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.getPharmacyRecords(user.clinicId, from, to);
  }
}
