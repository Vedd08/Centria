import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateAdmissionDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient selection is required' })
  patientId: string;

  @IsString()
  @IsNotEmpty({ message: 'Attending doctor selection is required' })
  doctorId: string;

  @IsString()
  @IsNotEmpty({ message: 'Bed selection is required' })
  bedId: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason for admission is required' })
  reasonForAdmission: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Admission date must be in YYYY-MM-DD format' })
  admissionDate?: string;

  /** When admitting from a doctor's admission recommendation, closes out that OPD queue entry. */
  @IsOptional()
  @IsString()
  queueId?: string;
}
