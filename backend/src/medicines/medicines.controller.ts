import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RefillStockDto } from './dto/refill-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateMedicineDto) {
    return this.medicinesService.create(user.clinicId, dto, user);
  }

  // Doctors need the catalog to prescribe; the dashboard low-stock tile reads it too.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT')
  @Get()
  findAll(@CurrentUser() user: any, @Query('search') search?: string, @Query('lowStock') lowStock?: string) {
    return this.medicinesService.findAll(user.clinicId, search, lowStock === 'true');
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.medicinesService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.medicinesService.update(user.clinicId, id, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Patch(':id/stock')
  adjustStock(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.medicinesService.adjustStock(user.clinicId, id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Post('refill')
  refillStock(@CurrentUser() user: any, @Body() dto: RefillStockDto) {
    return this.medicinesService.refillStock(user.clinicId, dto, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Get('batches/expiring')
  getExpiringBatches(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.medicinesService.getExpiringBatches(user.clinicId, Number(days) || 90);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Get('batches/:batchId/trace')
  getBatchTraceability(@CurrentUser() user: any, @Param('batchId') batchId: string) {
    return this.medicinesService.getBatchTraceability(user.clinicId, batchId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT')
  @Get(':id/movements')
  getStockMovements(@CurrentUser() user: any, @Param('id') id: string) {
    return this.medicinesService.getStockMovements(user.clinicId, id);
  }
}
