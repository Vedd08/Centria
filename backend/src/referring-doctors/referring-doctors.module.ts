import { Module } from '@nestjs/common';
import { ReferringDoctorsService } from './referring-doctors.service';
import { ReferringDoctorsController } from './referring-doctors.controller';

@Module({
  controllers: [ReferringDoctorsController],
  providers: [ReferringDoctorsService],
})
export class ReferringDoctorsModule {}
