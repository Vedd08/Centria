import { Module } from '@nestjs/common';
import { PatientDiaryController } from './patient-diary.controller';
import { PatientDiaryService } from './patient-diary.service';

@Module({
  controllers: [PatientDiaryController],
  providers: [PatientDiaryService],
})
export class PatientDiaryModule {}
