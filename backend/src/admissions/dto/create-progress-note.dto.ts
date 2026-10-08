import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateProgressNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Note content is required' })
  note: string;

  // Optional override — normally derived from the author's role (DOCTOR/NURSE) in the service.
  @IsOptional()
  @IsString()
  @IsIn(['DOCTOR', 'NURSE'], { message: 'Note type must be DOCTOR or NURSE' })
  noteType?: 'DOCTOR' | 'NURSE';

  /** When set, also updates the admission's current condition alongside this note. */
  @IsOptional()
  @IsString()
  @IsIn(['STABLE', 'NEEDS_ATTENTION', 'CRITICAL'], {
    message: 'Status must be STABLE, NEEDS_ATTENTION or CRITICAL',
  })
  status?: 'STABLE' | 'NEEDS_ATTENTION' | 'CRITICAL';

  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @IsOptional()
  @IsInt({ message: 'Pulse must be a whole number (bpm)' })
  @Min(0)
  pulse?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Temperature must be a number' })
  temperature?: number;

  @IsOptional()
  @IsInt({ message: 'SpO2 must be a whole number percentage' })
  @Min(0)
  @Max(100)
  spo2?: number;
}
