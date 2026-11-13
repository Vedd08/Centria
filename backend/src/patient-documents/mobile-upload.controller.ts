import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MobileUploadService } from './mobile-upload.service';
import { patientDocumentMulterOptions } from './multer.config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const UPLOAD_ROLES = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'NURSE', 'RECEPTION'] as const;

/** Signed-in staff create the QR link on their computer. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patient-documents/upload-links')
export class UploadLinksController {
  constructor(private readonly mobileUpload: MobileUploadService) {}

  @Roles(...UPLOAD_ROLES)
  @Post()
  create(@CurrentUser() user: any, @Body() body: { patientId: string; admissionId?: string; visitId?: string }) {
    return this.mobileUpload.createLink(user.clinicId, body, user);
  }
}

/**
 * The phone side. No sign-in: the signed, short-lived token in the URL is the
 * permission, and it only allows adding files to one patient.
 */
@Controller('patient-documents/mobile')
export class MobileUploadController {
  constructor(private readonly mobileUpload: MobileUploadService) {}

  @Get(':token')
  describe(@Param('token') token: string) {
    return this.mobileUpload.describe(token);
  }

  @Post(':token')
  @UseInterceptors(FileInterceptor('file', patientDocumentMulterOptions))
  upload(
    @Param('token') token: string,
    @Body() body: { category?: string; title?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mobileUpload.upload(token, body, file);
  }
}
