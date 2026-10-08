import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateMedicationOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Admission selection is required' })
  admissionId: string;

  @IsString()
  @IsNotEmpty({ message: 'Medicine selection is required' })
  medicineId: string;

  @IsString()
  @IsNotEmpty({ message: 'Dosage is required' })
  dosage: string;

  @IsString()
  @IsNotEmpty({ message: 'Route is required' })
  route: string;

  @IsString()
  @IsNotEmpty({ message: 'Frequency is required' })
  frequency: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must be in YYYY-MM-DD format' })
  startDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'End date must be in YYYY-MM-DD format' })
  endDate?: string;

  // Admin-overridable; defaults to the requesting doctor when omitted.
  @IsOptional()
  @IsString()
  doctorId?: string;
}
