import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CheckInDto } from './dto/check-in.dto';
import { AssessQueueDto } from './dto/assess-queue.dto';
import { UpdateQueueStatusDto } from './dto/update-queue-status.dto';
import { RequestAdmissionDto } from './dto/request-admission.dto';
import { UpdateBillPaymentDto } from './dto/update-bill-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Everyone working the floor can see the day's board. */
const BOARD_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'STAFF', 'RECEPTION', 'PHARMACY', 'RM'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM')
  @Post()
  checkIn(@CurrentUser() user: any, @Body() dto: CheckInDto) {
    return this.queueService.checkIn(user.clinicId, dto, user);
  }

  @Roles(...BOARD_ROLES)
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('doctorId') doctorId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('patientId') patientId?: string,
    @Query('search') search?: string,
  ) {
    return this.queueService.findAll(user.clinicId, { date, status, doctorId, departmentId, patientId, search }, user);
  }

  @Roles(...BOARD_ROLES)
  @Get('stats')
  getStats(@CurrentUser() user: any, @Query('date') date?: string) {
    return this.queueService.getStats(user.clinicId, date);
  }

  // The nurse's ward-admission worklist — must stay ahead of ':id' below.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'RECEPTION')
  @Get('pending-admissions')
  findPendingAdmissions(@CurrentUser() user: any) {
    return this.queueService.findPendingAdmissions(user.clinicId);
  }

  @Roles(...BOARD_ROLES)
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.queueService.findOne(user.clinicId, id);
  }

  // The prescription is handed to the patient, so the ward and service desk need it too.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'STAFF', 'PHARMACY', 'RECEPTION')
  @Get(':id/prescription')
  getPrescription(@CurrentUser() user: any, @Param('id') id: string) {
    return this.queueService.getPrescription(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'ACCOUNT', 'PHARMACY', 'DOCTOR')
  @Get(':id/bill')
  getBill(@CurrentUser() user: any, @Param('id') id: string) {
    return this.queueService.getBill(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'ACCOUNT')
  @Patch(':id/bill/payment')
  updateBillPayment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBillPaymentDto) {
    return this.queueService.updateBillPayment(user.clinicId, id, 'PATIENT', dto, user);
  }

  // OPD patients pay the pharmacist for their medicines on a bill of its own.
  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY', 'RECEPTION', 'ACCOUNT')
  @Get(':id/pharmacy-bill')
  getPharmacyBill(@CurrentUser() user: any, @Param('id') id: string) {
    return this.queueService.getPharmacyBill(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'PHARMACY', 'ACCOUNT')
  @Patch(':id/pharmacy-bill/payment')
  updatePharmacyBillPayment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBillPaymentDto) {
    return this.queueService.updateBillPayment(user.clinicId, id, 'PHARMACY', dto, user);
  }

  // Only a doctor decides OPD vs IPD and records the clinical assessment.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Patch(':id/assess')
  assess(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AssessQueueDto) {
    return this.queueService.assess(user.clinicId, id, dto, user);
  }

  // Only a doctor recommends admission — the nurse still decides the actual bed.
  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Patch(':id/request-admission')
  requestAdmission(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RequestAdmissionDto) {
    return this.queueService.requestAdmission(user.clinicId, id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'STAFF', 'RECEPTION')
  @Patch(':id/status')
  updateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateQueueStatusDto) {
    return this.queueService.updateStatus(user.clinicId, id, dto);
  }
}
