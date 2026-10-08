import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Values below include the ones the clinic's purchase register actually uses
// ("Input Goods/Service", "Cosmetic Usage", "Reconstructive", "Non Cosmetic Usage")
// alongside the originals, so historical rows validate as-is.
export const INPUT_CLASSIFICATIONS = [
  'Capital Goods',
  'Input Goods/Service',
  'Consumables',
  'Medicine Stock',
  'Other',
] as const;

export const ITC_ELIGIBILITIES = [
  'Full',
  'Mixed Use',
  'Cosmetic Usage',
  'Non Cosmetic Usage',
  'Reconstructive',
  'Ineligible',
] as const;

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty({ message: 'Vendor name is required' })
  vendorName: string;

  @IsString()
  @IsNotEmpty({ message: 'Vendor GSTIN is required' })
  vendorGstn: string;

  @IsString()
  @IsNotEmpty({ message: 'Vendor invoice number is required' })
  invoiceNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Invoice date is required (YYYY-MM-DD)' })
  invoiceDate: string;

  @IsString()
  @IsNotEmpty({ message: 'Item description is required' })
  itemDescription: string;

  @IsString()
  @IsIn(INPUT_CLASSIFICATIONS as unknown as string[], {
    message: `Input classification must be one of: ${INPUT_CLASSIFICATIONS.join(', ')}`,
  })
  inputClassification: string;

  @IsString()
  @IsIn(ITC_ELIGIBILITIES as unknown as string[], {
    message: `ITC eligibility must be one of: ${ITC_ELIGIBILITIES.join(', ')}`,
  })
  itcEligibility: string;

  @IsNumber()
  @Min(0, { message: 'Taxable value cannot be negative' })
  taxableValue: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'IGST cannot be negative' })
  igst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'CGST cannot be negative' })
  cgst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'SGST cannot be negative' })
  sgst?: number;
}
