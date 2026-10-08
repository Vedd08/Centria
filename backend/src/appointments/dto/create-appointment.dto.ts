import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  reasonForVisit?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['Scheduled', 'Checked-In', 'No-Show', 'Completed', 'Cancelled'])
  status?: string;
}
