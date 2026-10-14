import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { PAYMENT_MODES, PaymentDetailsDto, PaymentMode } from '../../common/payment-details';

export class PurchasePackageDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient selection is required' })
  patientId: string;

  @IsString()
  @IsNotEmpty({ message: 'Package type selection is required' })
  packageTypeId: string;

  /** What the patient is charged. Anything below the package price is recorded as a discount. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  /** Why the package was sold below its price — shown to doctors, reception and accounts. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountReason?: string;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cash', 'bank'], { message: 'Payment method must be cash or bank' })
  paymentMethod?: 'cash' | 'bank';

  @IsOptional()
  @IsIn(PAYMENT_MODES as unknown as string[], { message: `Payment mode must be one of: ${PAYMENT_MODES.join(', ')}` })
  paymentMode?: PaymentMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  paymentDetails?: PaymentDetailsDto;

  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsOptional()
  @IsString()
  linkToQueueId?: string;
}
