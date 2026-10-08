import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PrescriptionItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Medicine selection is required' })
  medicineId: string;

  @IsString()
  @IsNotEmpty({ message: 'Dosage is required (e.g. 500mg)' })
  dosage: string;

  @IsString()
  @IsNotEmpty({ message: 'Frequency is required (e.g. 1-0-1)' })
  frequency: string;

  @IsString()
  @IsNotEmpty({ message: 'Duration is required (e.g. 5 days)' })
  duration: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1 unit' })
  quantity: number;
}

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Visit selection is required' })
  visitId: string;

  /**
   * Optional: defaults to the authenticated user when a doctor writes their own
   * prescription. An admin recording on a doctor's behalf can name them explicitly.
   */
  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A prescription must contain at least one medicine' })
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}
