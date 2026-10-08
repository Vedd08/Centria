import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Note the decorators — the global ValidationPipe runs with `whitelist` and
 * `forbidNonWhitelisted`, so any property without one is treated as unknown and the
 * request is rejected outright.
 */
export class CreateClinicDto {
  @IsString()
  @IsNotEmpty({ message: 'Hospital name is required' })
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
