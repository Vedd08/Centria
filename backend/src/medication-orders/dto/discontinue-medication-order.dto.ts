import { IsNotEmpty, IsString } from 'class-validator';

export class DiscontinueMedicationOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'A reason for discontinuing this order is required' })
  discontinuedReason: string;
}
