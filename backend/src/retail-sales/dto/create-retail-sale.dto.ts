import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_MODES, PaymentDetailsDto, PaymentMode } from '../../common/payment-details';

export class RetailSaleItemDto {
  @IsString()
  medicineId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateRetailSaleDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  /** Legacy cash/bank split. Derived from paymentMode when that is sent instead. */
  @ValidateIf((o) => !o.paymentMode)
  @IsString()
  @IsNotEmpty()
  paymentMethod?: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RetailSaleItemDto)
  items: RetailSaleItemDto[];
}
