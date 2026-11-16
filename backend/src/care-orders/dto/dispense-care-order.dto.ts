import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * What the pharmacy actually hands over. Leave `quantity` out to give exactly what
 * the doctor prescribed; give fewer when the patient already has some at home, or
 * 0 when they need none of it (the item is then dropped from the bill).
 */
export class DispenseCareOrderDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  quantity?: number;

  /** Why the quantity differs, e.g. "Patient has 5 at home". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
