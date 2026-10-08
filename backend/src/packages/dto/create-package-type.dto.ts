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
}
