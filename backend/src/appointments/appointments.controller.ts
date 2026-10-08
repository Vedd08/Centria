import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR')
  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto, @CurrentUser() user: any) {
    return this.appointmentsService.create(createAppointmentDto, user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR')
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string
  ) {
    return this.appointmentsService.findAll(user.clinicId, { date, from, to, doctorId, status });
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR')
  @Get('slots/available')
  getAvailableSlots(
    @CurrentUser() user: any,
    @Query('doctorId') doctorId: string,
    @Query('date') date: string
  ) {
    if (!doctorId || !date) {
      return { slots: [], slotDuration: 15, sessions: [] };
    }
    return this.appointmentsService.getAvailableSlots(user.clinicId, doctorId, date);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR')
  @Get('slots/day')
  getDaySlots(
    @CurrentUser() user: any,
    @Query('date') date: string
  ) {
    if (!date) return [];
    return this.appointmentsService.getDaySlots(user.clinicId, date);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR')
  @Get('schedule/:doctorId')
  getDoctorSchedule(@Param('doctorId') doctorId: string, @CurrentUser() user: any) {
    return this.appointmentsService.getDoctorSchedule(user.clinicId, doctorId, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
  @Patch('schedule/:doctorId')
  updateDoctorSchedule(@Param('doctorId') doctorId: string, @Body() body: { schedules: any[] }, @CurrentUser() user: any) {
    return this.appointmentsService.updateDoctorSchedule(user.clinicId, doctorId, body.schedules, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.findOne(id, user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAppointmentDto: UpdateAppointmentDto, @CurrentUser() user: any) {
    return this.appointmentsService.update(id, updateAppointmentDto, user.clinicId);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.remove(id, user.clinicId);
  }
}
