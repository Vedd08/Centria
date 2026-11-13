import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReferringDoctorDto {
  @IsString()
  @IsNotEmpty({ message: "Referring doctor's name is required" })
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  hospital?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  speciality?: string;
}
