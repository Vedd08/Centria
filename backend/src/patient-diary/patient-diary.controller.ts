import { Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PatientDiaryService, DIARY_MAX_PHOTOS } from './patient-diary.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';

// Clinical roles only: these are photos of the patient.
const READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'STAFF'] as const;
const WRITE_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'STAFF'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patient-diary')
export class PatientDiaryController {
  constructor(private readonly diary: PatientDiaryService) {}

  @Roles(...READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: any, @Query('patientId') patientId: string, @Query('purchaseId') purchaseId?: string) {
    return this.diary.findAll(user.clinicId, patientId, purchaseId);
  }

  @Roles(...WRITE_ROLES)
  @Get('context')
  context(@CurrentUser() user: any, @Query('patientId') patientId: string, @Query('queueId') queueId?: string) {
    return this.diary.context(user.clinicId, patientId, queueId);
  }

  @Roles(...WRITE_ROLES)
  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', DIARY_MAX_PHOTOS, {
      storage: memoryStorage(),
      // The browser shrinks photos before upload; this only stops oversized originals.
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  create(@CurrentUser() user: any, @Body() dto: CreateDiaryEntryDto, @UploadedFiles() files: Express.Multer.File[]) {
    return this.diary.create(user, dto, files ?? []);
  }

  @Roles(...READ_ROLES)
  @Get('photos/:id')
  async photo(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const photo = await this.diary.photo(user.clinicId, id);
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(Buffer.from(photo.data));
  }

  @Roles(...WRITE_ROLES)
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.diary.remove(user, id);
  }
}
