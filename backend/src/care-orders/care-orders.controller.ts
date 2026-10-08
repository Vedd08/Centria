import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CareOrdersService } from './care-orders.service';
import { CreateCareOrderDto } from './dto/create-care-order.dto';
import { PerformCareOrderDto } from './dto/perform-care-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'STAFF', 'PHARMACY', 'RECEPTION'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('care-orders')
export class CareOrdersController {
  constructor(private readonly careOrdersService: CareOrdersService) {}

  // Ordering care is a clinical decision — staff carry orders out but don't raise them.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateCareOrderDto) {
    return this.careOrdersService.create(user.clinicId, dto, user);
  }

  @Roles(...READ_ROLES)
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('queueId') queueId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('pendingDispense') pendingDispense?: string,
  ) {
    return this.careOrdersService.findAll(
      user.clinicId,
      { queueId, patientId, status, date, pendingDispense: pendingDispense === 'true' },
      user,
    );
  }

  @Roles(...READ_ROLES)
  @Get('charges/:queueId')
  getQueueCharges(@CurrentUser() user: any, @Param('queueId') queueId: string) {
    return this.careOrdersService.getQueueCharges(user.clinicId, queueId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Get('pharmacy-bill/:queueId')
  getPharmacyBill(@CurrentUser() user: any, @Param('queueId') queueId: string) {
    return this.careOrdersService.getPharmacyBill(user.clinicId, queueId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'STAFF')
  @Patch(':id/perform')
  perform(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: PerformCareOrderDto) {
    return this.careOrdersService.perform(user.clinicId, id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Patch(':id/untag')
  untag(@CurrentUser() user: any, @Param('id') id: string, @Body('templateName') templateName: string) {
    return this.careOrdersService.untag(user.clinicId, id, templateName);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Patch(':id/cancel')
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.careOrdersService.cancel(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Delete(':id')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.careOrdersService.delete(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY')
  @Patch(':id/dispense')
  dispense(@CurrentUser() user: any, @Param('id') id: string) {
    return this.careOrdersService.dispense(user.clinicId, id, user);
  }
}
