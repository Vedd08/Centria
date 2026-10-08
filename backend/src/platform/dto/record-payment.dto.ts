import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Amount must be more than zero' })
  @IsNotEmpty()
  amount: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Paid-on date must be YYYY-MM-DD' })
  paidOn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Period start must be YYYY-MM-DD' })
  periodFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Period end must be YYYY-MM-DD' })
  periodTo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cash', 'bank', 'upi', 'card'], { message: 'Method must be cash, bank, upi or card' })
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
