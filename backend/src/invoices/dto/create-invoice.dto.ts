import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  @IsIn(['cash', 'bank'], { message: 'Payment method must be cash or bank' })
  paymentMethod: 'cash' | 'bank';

  @IsOptional()
  @IsString()
  paymentRef?: string;
}
