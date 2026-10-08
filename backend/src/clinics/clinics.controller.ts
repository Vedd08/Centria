import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /**
   * The caller's own clinic, for the letterhead on their bills and prescriptions.
   * Open to every signed-in role — staff print paperwork all day — and scoped to the
   * clinic on the request, so it can never read another hospital's details.
   *
   * Must stay above `@Get(':id')`: Nest matches in declaration order, and below it
   * this route would be swallowed as a clinic id and rejected as non-SUPER_ADMIN.
   */
  @Get('me')
  letterhead(@CurrentUser() user: any) {
    return this.clinicsService.letterhead(user?.clinicId);
  }

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

  @Roles('SUPER_ADMIN')
  @Get()
  findAll() {
    return this.clinicsService.findAll();
  }

  @Roles('SUPER_ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clinicsService.findOne(id);
  }

  @Roles('SUPER_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.update(id, dto);
  }
}
