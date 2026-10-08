import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CheckInDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient selection is required' })
  patientId: string;

  @IsOptional()
  @IsString()
  complaint?: string;

  /** Which department the patient is here for. Drives the token series. */
  @IsOptional()
  @IsString()
  departmentId?: string;

  /** Reception may send the patient to a specific doctor at check-in. */
  @IsOptional()
  @IsString()
  doctorId?: string;

  /**
   * The desk's expectation of where this patient is headed (a walk-in consult vs a
   * booked procedure). The doctor can still change it during assessment.
   */
  @IsOptional()
  @IsString()
  @IsIn(['OPD', 'IPD'], { message: 'Care type must be OPD or IPD' })
  careType?: 'OPD' | 'IPD';

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Queue date must be in YYYY-MM-DD format' })
  queueDate?: string;
}
