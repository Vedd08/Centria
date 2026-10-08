import { Controller, Get, Post, Body, Param, Query, UseGuards, Put, Delete } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'RM', 'RECEPTION')
  @Post()
  create(@CurrentUser() user: any, @Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(user.clinicId, createPatientDto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'NURSE', 'STAFF')
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.patientsService.findAll(user.clinicId, search, page ? parseInt(page, 10) : 1, pageSize ? parseInt(pageSize, 10) : 20);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'NURSE', 'STAFF')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.patientsService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'NURSE', 'STAFF')
  @Get(':id/lifetime-value')
  getLifetimeValue(@CurrentUser() user: any, @Param('id') id: string) {
    return this.patientsService.getLifetimeValue(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'NURSE', 'STAFF')
  @Get(':id/progress')
  getProgress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.patientsService.getProgress(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RM', 'RECEPTION')
  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updatePatientDto: UpdatePatientDto) {
    return this.patientsService.update(user.clinicId, id, updatePatientDto);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.patientsService.remove(user.clinicId, id);
  }
}
