import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

/**
 * OCCUPIED is deliberately not an accepted value here — that transition only ever
 * happens as a side effect of admission/discharge, never a direct manual edit.
 */
export class UpdateBedDto {
  @IsOptional()
  @IsString()
  bedNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(['AVAILABLE', 'MAINTENANCE'], { message: 'Status must be AVAILABLE or MAINTENANCE' })
  status?: 'AVAILABLE' | 'MAINTENANCE';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
