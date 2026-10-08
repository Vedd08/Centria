import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^[+]?[\d\s-]{7,15}$/, { message: 'Phone number must be 7-15 digits (can include +, -, spaces)' })
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsString()
  @IsNotEmpty({ message: 'Gender selection is required' })
  gender: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  allergyNotes?: string;

  @IsOptional()
  @IsString()
  referringDoctor?: string;

  @IsOptional()
  @IsString()
  howHeardAboutUs?: string;
}
