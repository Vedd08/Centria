import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ReferringDoctorsService } from './referring-doctors.service';
import { CreateReferringDoctorDto } from './dto/create-referring-doctor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Whoever registers a patient can pick, and add, the doctor who referred them. */
const FRONT_DESK_ROLES = ['SUPER_ADMIN', 'MASTER', 'RECEPTION', 'RM', 'DOCTOR'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('referring-doctors')
export class ReferringDoctorsController {
  constructor(private readonly referringDoctorsService: ReferringDoctorsService) {}

  @Roles(...FRONT_DESK_ROLES, 'ACCOUNT')
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.referringDoctorsService.findAll(user.clinicId);
  }

  @Roles(...FRONT_DESK_ROLES)
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateReferringDoctorDto) {
    return this.referringDoctorsService.create(user.clinicId, dto);
  }
}
