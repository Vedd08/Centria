import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpsertDepartmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Department name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'A short code is required — it prefixes the token, e.g. CARD' })
  @MaxLength(6, { message: 'Keep the code to 6 characters or fewer' })
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Code must be letters and numbers only' })
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
