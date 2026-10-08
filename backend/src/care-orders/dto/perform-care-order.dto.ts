import { IsOptional, IsString } from 'class-validator';

export class PerformCareOrderDto {
  @IsOptional()
  @IsString()
  performNotes?: string;
}
