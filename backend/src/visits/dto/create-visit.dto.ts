import { IsNotEmpty, IsNumber, IsOptional, IsString, IsIn, Matches, Min } from 'class-validator';

export const VISIT_TYPES = ['OPD', 'IPD'] as const;
export const VISIT_STATUSES = ['New', 'Follow Up', 'Dressing'] as const;

export class CreateVisitDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient selection is required' })
  patientId: string;

  @IsOptional()
  @IsString()
  @IsIn(VISIT_TYPES as unknown as string[], { message: 'Visit type must be OPD or IPD' })
  visitType?: string;

  @IsString()
  @IsNotEmpty({ message: 'Doctor User selection is required' })
  doctorId: string;

  // Optional: the day-books leave the relationship manager blank on nearly every row.
  @IsOptional()
  @IsString()
  rmId?: string;

  @IsOptional()
  @IsString()
  clientRm?: string;

  @IsString()
  @IsNotEmpty({ message: 'Operator name is required' })
  operator: string;

  @IsOptional()
  @IsString()
  treatmentId?: string;

  @IsOptional()
  @IsString()
  packagePurchaseId?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsIn(['IMPROVING', 'SAME', 'WORSENING'])
  conditionTrend?: string;

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

  @IsString()
  @IsIn(VISIT_STATUSES as unknown as string[], {
    message: `Status must be one of: ${VISIT_STATUSES.join(', ')}`,
  })
  status: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Next appointment date must be in YYYY-MM-DD format' })
  nextAppointmentDate?: string;
}
