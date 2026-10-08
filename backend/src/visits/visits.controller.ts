import { Controller, Get, Post, Body, Param, Query, UseGuards, Put, Delete, Req } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM')
  @Post()
  create(@CurrentUser() user: any, @Body() createVisitDto: CreateVisitDto) {
    return this.visitsService.create(user.clinicId, createVisitDto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY')
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('rmId') rmId?: string,
    @Query('visitType') visitType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.visitsService.findAll(
      user.clinicId,
      { patientId, doctorId, rmId, visitType, from, to, status, search },
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.visitsService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM')
  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateDto: UpdateVisitDto) {
    return this.visitsService.update(user.clinicId, id, updateDto, user);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.visitsService.remove(user.clinicId, id);
  }
}
