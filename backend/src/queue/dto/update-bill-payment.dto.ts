import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { PAYMENT_MODES, PaymentDetailsDto, PaymentMode } from '../../common/payment-details';

export const BILL_PAYMENT_STATUSES = ['PAID', 'UNPAID'] as const;

export class UpdateBillPaymentDto {
  @IsString()
  @IsIn(BILL_PAYMENT_STATUSES as unknown as string[], {
    message: `Payment status must be one of: ${BILL_PAYMENT_STATUSES.join(', ')}`,
  })
  @IsNotEmpty()
  status: string;

  /** Required when the bill is marked paid; cleared when it goes back to unpaid. */
  @ValidateIf((o) => o.status === 'PAID')
  @IsString()
  @IsIn(PAYMENT_MODES as unknown as string[], {
    message: `Payment mode must be one of: ${PAYMENT_MODES.join(', ')}`,
  })
  @IsNotEmpty()
  mode?: PaymentMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  details?: PaymentDetailsDto;
}
