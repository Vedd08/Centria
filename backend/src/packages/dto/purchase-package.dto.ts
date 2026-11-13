import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

  /** Discount in ₹ off the package's list price. The amount charged is list − discount. */
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Discount cannot be negative' })
  discount?: number;

  /** Why the discount was given — required whenever there is one. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  discountReason?: string;

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

  @IsOptional()
  @IsString()
  linkToQueueId?: string;
}
