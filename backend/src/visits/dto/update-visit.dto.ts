import { IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { VISIT_STATUSES, VISIT_TYPES } from './create-visit.dto';

/**
 * Deliberately narrower than CreateVisitDto.
 *
 * `isGstTaxable` and `treatmentPrice` are absent because Business Rule 1 requires them
 * to be derived from TreatmentMaster, never accepted from a client. Changing the
 * treatment is allowed — the service re-derives both fields from the new treatment.
 *
 * `patientId` and `packagePurchaseId` are also absent: re-pointing a visit at a
 * different patient or package would desynchronise the sitting counters that
 * Business Rule 2 decrements at creation time.
 */
export class UpdateVisitDto {
  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  rmId?: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsOptional()
  @IsString()
  treatmentId?: string;

  @IsOptional()
  @IsString()
  @IsIn(VISIT_TYPES as unknown as string[], { message: 'Visit type must be OPD or IPD' })
  visitType?: string;

  @IsOptional()
  @IsString()
  clientRm?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  otherRemarks?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Cash amount must be a number' })
  @Min(0)
  cashAmount?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Bank amount must be a number' })
  @Min(0)
  bankAmount?: number;

  @IsOptional()
  @IsString()
  paymentRefId?: string;

  @IsOptional()
  @IsString()
  @IsIn(VISIT_STATUSES as unknown as string[], {
    message: `Status must be one of: ${VISIT_STATUSES.join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Next appointment date must be in YYYY-MM-DD format' })
  nextAppointmentDate?: string;
}
