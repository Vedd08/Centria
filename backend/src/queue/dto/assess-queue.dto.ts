import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

/**
 * The doctor's decision for a queued patient: what they found and whether the
 * patient continues as an outpatient or is routed to inpatient care.
 */
export class AssessQueueDto {
  @IsString()
  @IsIn(['OPD', 'IPD'], { message: 'Care type must be OPD or IPD' })
  @IsNotEmpty({ message: 'Choose whether this patient is OPD or IPD' })
  careType: 'OPD' | 'IPD';

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsIn(['IMPROVING', 'SAME', 'WORSENING'])
  conditionTrend?: string;

  @IsOptional()
  @IsString()
  doctorNotes?: string;

  /** Advice printed on the patient's prescription. */
  @IsOptional()
  @IsString()
  patientNotes?: string;

  /** Instructions for the nurse/service desk — never printed for the patient. */
  @IsOptional()
  @IsString()
  staffNotes?: string;

  /** The doctor's consultation charge, carried onto the patient's bill. */
  @IsOptional()
  @IsNumber({}, { message: 'Consultation fee must be a number' })
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Next appointment must be in YYYY-MM-DD format' })
  nextAppointmentDate?: string;

  /** Optionally record the encounter in the day book at the same time. */
  @IsOptional()
  @IsString()
  treatmentId?: string;

  /** If the patient is redeeming a package sitting */
  @IsOptional()
  @IsString()
  usePackagePurchaseId?: string;

  /** If the doctor recommends a new package */
  @IsOptional()
  @IsString()
  recommendedPackageTypeId?: string;
}
