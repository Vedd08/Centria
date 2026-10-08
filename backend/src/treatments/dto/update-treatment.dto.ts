import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTreatmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isGstTaxable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Treatment price cannot be negative' })
  price?: number;
}
