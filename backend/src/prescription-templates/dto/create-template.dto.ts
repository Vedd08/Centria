import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export const TEMPLATE_ITEM_TYPES = ['MEDICINE', 'INJECTION', 'TREATMENT', 'OTHER'] as const;

export class TemplateItemDto {
  @IsString()
  @IsIn(TEMPLATE_ITEM_TYPES as unknown as string[], {
    message: `Item type must be one of: ${TEMPLATE_ITEM_TYPES.join(', ')}`,
  })
  orderType: string;

  @IsOptional()
  @IsString()
  medicineId?: string;

  @IsOptional()
  notStocked?: boolean;

  @IsOptional()
  @IsString()
  treatmentId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Give the template a name' })
  name: string;

  @IsOptional()
  @IsString()
  condition?: string;

  /** Other words for the condition, comma-separated — drives auto-suggestion. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  keywords?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  patientNotes?: string;

  @IsOptional()
  @IsString()
  staffNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items?: TemplateItemDto[];
}
