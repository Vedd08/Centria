import { Module } from '@nestjs/common';
import { PatientDocumentsService } from './patient-documents.service';
import { PatientDocumentsController } from './patient-documents.controller';
import { MobileUploadService } from './mobile-upload.service';
import { MobileUploadController, UploadLinksController } from './mobile-upload.controller';

@Module({
  // The two upload-link controllers are registered first so their two-segment
  // routes are matched before the generic `:id` routes.
  controllers: [UploadLinksController, MobileUploadController, PatientDocumentsController],
  providers: [PatientDocumentsService, MobileUploadService],
  exports: [PatientDocumentsService],
})
export class PatientDocumentsModule {}
