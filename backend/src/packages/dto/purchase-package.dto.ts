import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PurchasePackageDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient selection is required' })
  patientId: string;

  @IsString()
  @IsNotEmpty({ message: 'Package type selection is required' })
  packageTypeId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cash', 'bank'], { message: 'Payment method must be cash or bank' })
  paymentMethod?: 'cash' | 'bank';

  @IsOptional()
  @IsString()
  paymentRef?: string;
}
