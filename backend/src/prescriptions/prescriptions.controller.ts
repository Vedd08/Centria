import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(user.clinicId, dto, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'NURSE', 'STAFF')
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('visitId') visitId?: string,
    @Query('status') status?: string,
  ) {
    return this.prescriptionsService.findAll(user.clinicId, { patientId, visitId, status });
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'NURSE', 'STAFF')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.prescriptionsService.findOne(user.clinicId, id);
  }

  // Dispensing moves physical stock, so it is restricted to the pharmacy desk.
  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Patch(':id/dispense')
  dispense(@CurrentUser() user: any, @Param('id') id: string) {
    return this.prescriptionsService.dispense(user.clinicId, id, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.prescriptionsService.remove(user.clinicId, id, user);
  }
}
