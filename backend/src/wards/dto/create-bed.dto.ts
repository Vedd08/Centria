import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBedDto {
  @IsString()
  @IsNotEmpty({ message: 'Bed number is required' })
  bedNumber: string;
}
