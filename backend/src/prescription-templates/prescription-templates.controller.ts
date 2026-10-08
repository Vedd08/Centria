import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PrescriptionTemplatesService } from './prescription-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Templates are a doctor's own clinical shorthand — only doctors manage them. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'MASTER', 'DOCTOR')
@Controller('prescription-templates')
export class PrescriptionTemplatesController {
  constructor(private readonly templatesService: PrescriptionTemplatesService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(user.clinicId, dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.templatesService.findAll(user.clinicId, user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.templatesService.findOne(user.clinicId, id, user);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateTemplateDto) {
    return this.templatesService.update(user.clinicId, id, dto, user);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.templatesService.remove(user.clinicId, id, user);
  }

  @Post(':id/apply/:queueId')
  apply(@CurrentUser() user: any, @Param('id') id: string, @Param('queueId') queueId: string) {
    return this.templatesService.applyToQueue(user.clinicId, id, queueId, user);
  }
}
