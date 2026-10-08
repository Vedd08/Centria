import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { TreatmentsService } from './treatments.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('treatments')
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  @Roles('SUPER_ADMIN', 'MASTER')
  @Post()
  create(@CurrentUser() user: any, @Body() createTreatmentDto: CreateTreatmentDto) {
    return this.treatmentsService.create(user.clinicId, createTreatmentDto);
  }

  // The treatment catalog drives the visit-logging and billing dropdowns, so every
  // clinical and front-desk role needs read access. Editing stays admin-only.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT')
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.treatmentsService.findAll(user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.treatmentsService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateTreatmentDto: UpdateTreatmentDto) {
    return this.treatmentsService.update(user.clinicId, id, updateTreatmentDto);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.treatmentsService.remove(user.clinicId, id);
  }
}
