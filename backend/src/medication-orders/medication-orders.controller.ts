import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MedicationOrdersService } from './medication-orders.service';
import { CreateMedicationOrderDto } from './dto/create-medication-order.dto';
import { DiscontinueMedicationOrderDto } from './dto/discontinue-medication-order.dto';
import { MarkAdministeredDto } from './dto/mark-administered.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const CHART_READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MedicationOrdersController {
  constructor(private readonly medicationOrdersService: MedicationOrdersService) {}

  // Prescribing is a doctor action — NURSE administers but does not order.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post('medication-orders')
  create(@CurrentUser() user: any, @Body() dto: CreateMedicationOrderDto) {
    return this.medicationOrdersService.create(user.clinicId, dto, user);
  }

  @Roles(...CHART_READ_ROLES)
  @Get('medication-orders')
  findAll(@CurrentUser() user: any, @Query('admissionId') admissionId: string) {
    return this.medicationOrdersService.findAll(user.clinicId, admissionId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Patch('medication-orders/:id/discontinue')
  discontinue(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: DiscontinueMedicationOrderDto) {
    return this.medicationOrdersService.discontinue(user.clinicId, id, dto);
  }

  @Roles(...CHART_READ_ROLES)
  @Post('medication-orders/:id/administrations')
  markAdministered(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: MarkAdministeredDto) {
    return this.medicationOrdersService.markAdministered(user.clinicId, id, dto, user);
  }

  @Roles(...CHART_READ_ROLES)
  @Get('medication-orders/:id/administrations')
  getAdministrations(@CurrentUser() user: any, @Param('id') id: string) {
    return this.medicationOrdersService.getAdministrations(user.clinicId, id);
  }
}
