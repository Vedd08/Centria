import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWardDto {
  @IsString()
  @IsNotEmpty({ message: 'Ward name is required' })
  name: string;

  @IsOptional()
  @IsString()
  floor?: string;
}
