import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMedicineDto {
  @IsString()
  @IsNotEmpty({ message: 'Medicine name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Dispensing unit is required (e.g. tablet, vial, ml, tube)' })
  unit: string;

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
