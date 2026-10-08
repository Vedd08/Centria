import { Type } from 'class-transformer';
import { IsArray, IsDecimal, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class RefillStockItemDto {
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @IsString()
  @IsNotEmpty()
  batchNumber: string;

  @IsString()
  @IsNotEmpty()
  expiryDate: string; // YYYY-MM-DD

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  costPrice: number;
}

export class RefillStockDto {
  @IsString()
  @IsNotEmpty()
  vendorName: string;

  @IsOptional()
  @IsString()
  vendorGstn?: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsString()
  @IsNotEmpty()
  invoiceDate: string; // YYYY-MM-DD

  @IsNumber()
  @Min(0)
  totalValue: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefillStockItemDto)
  items: RefillStockItemDto[];
}
