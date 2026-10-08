import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { WardsService } from './wards.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'RECEPTION'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WardsController {
  constructor(private readonly wardsService: WardsService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'NURSE')
  @Post('wards')
  createWard(@CurrentUser() user: any, @Body() dto: CreateWardDto) {
    return this.wardsService.createWard(user.clinicId, dto);
  }

  @Roles(...READ_ROLES)
  @Get('wards')
  findAllWards(@CurrentUser() user: any) {
    return this.wardsService.findAllWards(user.clinicId);
  }

  @Roles(...READ_ROLES)
  @Get('wards/:id')
  findOneWard(@CurrentUser() user: any, @Param('id') id: string) {
    return this.wardsService.findOneWard(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'NURSE')
  @Put('wards/:id')
  updateWard(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.wardsService.updateWard(user.clinicId, id, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'NURSE')
  @Post('wards/:wardId/beds')
  addBed(@CurrentUser() user: any, @Param('wardId') wardId: string, @Body() dto: CreateBedDto) {
    return this.wardsService.addBed(user.clinicId, wardId, dto);
  }

  @Roles(...READ_ROLES)
  @Get('beds')
  findAllBeds(@CurrentUser() user: any, @Query('wardId') wardId?: string, @Query('status') status?: string) {
    return this.wardsService.findAllBeds(user.clinicId, { wardId, status });
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'RECEPTION', 'NURSE')
  @Put('beds/:id')
  updateBed(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.wardsService.updateBed(user.clinicId, id, dto);
  }
}
