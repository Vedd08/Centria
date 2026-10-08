import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { DischargeAdmissionDto } from './dto/discharge-admission.dto';
import { CreateProgressNoteDto } from './dto/create-progress-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Every clinical (IPD board) reader — RECEPTION included since they staff the ward desk. */
const BOARD_READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'RECEPTION'] as const;
/** Clinical-chart readers — RECEPTION excluded, progress notes/meds are clinical data. */
const CHART_READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'NURSE', 'DOCTOR')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateAdmissionDto) {
    return this.admissionsService.create(user.clinicId, dto, user);
  }

  @Roles(...BOARD_READ_ROLES)
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('wardId') wardId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admissionsService.findAll(
      user.clinicId,
      { status, patientId, wardId, search },
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Roles(...BOARD_READ_ROLES)
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.admissionsService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE')
  @Patch(':id/discharge')
  discharge(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: DischargeAdmissionDto) {
    return this.admissionsService.discharge(user.clinicId, id, dto, user);
  }

  @Roles(...CHART_READ_ROLES)
  @Post(':id/progress-notes')
  addProgressNote(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateProgressNoteDto) {
    return this.admissionsService.addProgressNote(user.clinicId, id, dto, user);
  }

  @Roles(...CHART_READ_ROLES)
  @Get(':id/progress-notes')
  getProgressNotes(@CurrentUser() user: any, @Param('id') id: string) {
    return this.admissionsService.getProgressNotes(user.clinicId, id);
  }
}
