import { IsNotEmpty, IsString } from 'class-validator';

export class RequestAdmissionDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason for admission is required' })
  reason: string;
}
