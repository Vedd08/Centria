import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { UpsertDepartmentDto } from './dto/upsert-department.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Anyone who routes or treats a patient needs to read departments. */
const READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RECEPTION', 'RM', 'NURSE', 'STAFF', 'PHARMACY'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Roles('SUPER_ADMIN', 'MASTER')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: UpsertDepartmentDto) {
    return this.departmentsService.create(user.clinicId, dto);
  }

  @Roles(...READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: any, @Query('activeOnly') activeOnly?: string) {
    return this.departmentsService.findAll(user.clinicId, activeOnly === 'true');
  }

  @Roles(...READ_ROLES)
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.departmentsService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpsertDepartmentDto) {
    return this.departmentsService.update(user.clinicId, id, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.departmentsService.remove(user.clinicId, id);
  }
}
