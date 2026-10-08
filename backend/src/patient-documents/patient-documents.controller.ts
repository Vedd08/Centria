import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { PatientDocumentsService } from './patient-documents.service';
import { CreatePatientDocumentDto } from './dto/create-patient-document.dto';
import { patientDocumentMulterOptions, PATIENT_DOCUMENTS_UPLOAD_DIR } from './multer.config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const READ_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'RM', 'RECEPTION', 'PHARMACY'] as const;
const UPLOAD_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'RECEPTION'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patient-documents')
export class PatientDocumentsController {
  constructor(private readonly patientDocumentsService: PatientDocumentsService) {}

  @Roles(...UPLOAD_ROLES)
  @Post()
  @UseInterceptors(FileInterceptor('file', patientDocumentMulterOptions))
  create(
    @CurrentUser() user: any,
    @Body() dto: CreatePatientDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.patientDocumentsService.create(user.clinicId, dto, file, user);
  }

  @Roles(...READ_ROLES)
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('category') category?: string,
    @Query('visitId') visitId?: string,
    @Query('admissionId') admissionId?: string,
  ) {
    return this.patientDocumentsService.findAll(user.clinicId, { patientId, category, visitId, admissionId }, user);
  }

  @Roles(...READ_ROLES)
  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.patientDocumentsService.findOne(user.clinicId, id);
  }

  @Roles(...READ_ROLES)
  @Get(':id/file')
  async streamFile(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const doc = await this.patientDocumentsService.findOne(user.clinicId, id);
    const filePath = join(PATIENT_DOCUMENTS_UPLOAD_DIR, doc.storedFileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('The file for this document could not be found on disk');
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    fs.createReadStream(filePath).pipe(res);
  }

  @Roles('SUPER_ADMIN', 'MASTER')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.patientDocumentsService.remove(user.clinicId, id);
  }
}
