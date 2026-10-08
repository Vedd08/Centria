import { Controller, Delete, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT', 'NURSE', 'STAFF'])
  role: string;

  @IsString()
  @IsOptional()
  clinicId?: string;

  /** Links a NURSE/STAFF account to the doctor whose orders they carry out. */
  @IsString()
  @IsOptional()
  assignedDoctorId?: string;

  /** Which department this person works in. */
  @IsString()
  @IsOptional()
  departmentId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT', 'NURSE', 'STAFF'])
  role?: string;

  @IsOptional()
  @IsString()
  clinicId?: string;

  /** Pass an empty string to unlink this staff member from their doctor. */
  @IsOptional()
  @IsString()
  assignedDoctorId?: string;

  /** Pass an empty string to take this person out of their department. */
  @IsOptional()
  @IsString()
  departmentId?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT')
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    // If user is SUPER_ADMIN, maybe they can see all users if they don't have a clinicId,
    // but typically we scope to their active clinicId.
    return this.usersService.findAll(user.clinicId, role, search, limit ? parseInt(limit, 10) : undefined);
  }

  @Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT')
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usersService.findOne(user.clinicId, id);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateUserDto) {
    // Determine the clinicId to assign.
    // SUPER_ADMIN can create a user for a specific clinic by passing clinicId.
    // Otherwise, default to the creator's clinicId.
    let targetClinicId = user.clinicId;
    if (user.role === 'SUPER_ADMIN' && dto.clinicId) {
      targetClinicId = dto.clinicId;
    }
    return this.usersService.create(targetClinicId, dto);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.clinicId, id, dto, user.role);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usersService.remove(user.clinicId, id, user.role);
  }
}
