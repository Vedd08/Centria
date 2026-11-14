import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

/** One treatment in the package, with its own sittings and gap. */
export class PackageTypeItemDto {
  @IsOptional()
  @IsString()
  treatmentId?: string;

  /** Label when the treatment isn't in the catalogue (otherwise the treatment's name). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsInt({ message: 'Sittings must be a whole number' })
  @Min(1, { message: 'Each treatment needs at least 1 sitting' })
  sittings: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Gap between sittings must be at least 1 day' })
  sittingGapDays?: number | null;
}

export class CreatePackageTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'Package name is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  /** Derived from `items` when they are sent. */
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Total sittings must be at least 1' })
  totalSittings?: number;

  /** The treatments in the package. Older clients send totalSittings/treatmentId instead. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one treatment to the package' })
  @ValidateNested({ each: true })
  @Type(() => PackageTypeItemDto)
  items?: PackageTypeItemDto[];

  @IsOptional()
  @IsBoolean()
  isGstTaxable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  sittingGapDays?: number;

  /** Days the package stays valid after sale (e.g. 90). Empty/null = no expiry. */
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Validity must be at least 1 day' })
  validityDays?: number | null;

  @IsOptional()
  @IsBoolean()
  skipSundays?: boolean;

  @IsOptional()
  @IsBoolean()
  skipHolidays?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  treatmentId?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;
}
