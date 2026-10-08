import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTreatmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Treatment name is required' })
  name: string;

  @IsBoolean()
  isGstTaxable: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Treatment price cannot be negative' })
  price?: number;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsNumber()
  taxRate?: number;
}
