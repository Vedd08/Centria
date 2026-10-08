import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MarkAdministeredDto {
  @IsString()
  @IsIn(['Given', 'Missed', 'Refused'], { message: 'Status must be Given, Missed, or Refused' })
  @IsNotEmpty()
  status: 'Given' | 'Missed' | 'Refused';

  @IsOptional()
  @IsString()
  notes?: string;
}
