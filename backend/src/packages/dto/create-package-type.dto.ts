import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePackageTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'Package name is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(1, { message: 'Total sittings must be at least 1' })
  totalSittings: number;

  @IsOptional()
  @IsBoolean()
  isGstTaxable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  sittingGapDays?: number;

  /** Days the package stays valid after sale (e.g. 90). Empty/null = no expiry. */
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Validity must be at least 1 day' })
  validityDays?: number | null;

  @IsOptional()
  @IsBoolean()
  skipSundays?: boolean;

  @IsOptional()
  @IsBoolean()
  skipHolidays?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  treatmentId?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;
}
