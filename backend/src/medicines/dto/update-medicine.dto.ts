import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMedicineDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Stock quantity cannot be negative' })
  stockQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Reorder point cannot be negative' })
  reorderPoint?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Unit price cannot be negative' })
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isGstTaxable?: boolean;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsString()
  shelf?: string;
}
