import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RetailSaleItemDto)
  items: RetailSaleItemDto[];
}
