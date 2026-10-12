import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';

/** A medicine that arrived on the wholesaler bill but isn't in the catalogue yet. */
export class RefillNewMedicineDto {
  @IsString()
  @IsNotEmpty({ message: 'New medicine name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Dispensing unit is required for a new medicine (e.g. tablet, tube, bottle)' })
  unit: string;

  /** Selling price per unit — what the counter charges. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;
}

export class RefillStockItemDto {
  /** An existing catalogue medicine — or send `newMedicine` instead. */
  @ValidateIf((o) => !o.newMedicine)
  @IsString()
  @IsNotEmpty()
  medicineId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RefillNewMedicineDto)
  newMedicine?: RefillNewMedicineDto;

  /** Rack / shelf the stock is put away on. Updates the medicine's location when sent. */
  @IsOptional()
  @IsString()
  shelf?: string;

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
  @IsOptional()
  @IsString()
  purchaseId?: string;

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
