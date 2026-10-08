import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export const CARE_ORDER_TYPES = ['MEDICINE', 'INJECTION', 'TREATMENT', 'OTHER'] as const;

export class CreateCareOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Queue entry is required' })
  queueId: string;

  @IsString()
  @IsIn(CARE_ORDER_TYPES as unknown as string[], {
    message: `Order type must be one of: ${CARE_ORDER_TYPES.join(', ')}`,
  })
  orderType: string;

  /** Required for MEDICINE/INJECTION so the pharmacy can dispense against stock. */
  @IsOptional()
  @IsString()
  medicineId?: string;

  @IsOptional()
  @IsString()
  treatmentId?: string;

  /** Free-text label, used when the order is not a catalogue item. */
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsInt({ message: 'Quantity must be a whole number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity?: number;
}
