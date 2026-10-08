import { Module } from '@nestjs/common';
import { PrescriptionTemplatesService } from './prescription-templates.service';
import { PrescriptionTemplatesController } from './prescription-templates.controller';

@Module({
  controllers: [PrescriptionTemplatesController],
  providers: [PrescriptionTemplatesService],
  exports: [PrescriptionTemplatesService],
})
export class PrescriptionTemplatesModule {}
