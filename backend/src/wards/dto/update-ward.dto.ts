import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
