import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { PAYMENT_MODES, PaymentDetailsDto, PaymentMode } from '../../common/payment-details';

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  visitId?: string;

  @IsOptional()
  @IsString()
  packagePurchaseId?: string;

  @IsOptional()
  @IsString()
  queueId?: string;

  @IsOptional()
  @IsString()
  retailSaleId?: string;

  @IsNumber()
  @Min(0)
  taxableValue: number;

  /** Legacy cash/bank split. Derived from paymentMode when that is sent instead. */
  @ValidateIf((o) => !o.paymentMode)
  @IsString()
  @IsNotEmpty()
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
}
