import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED', 'CANCELLED'] as const;

export class UpsertSubscriptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  planName: string;

  @IsNumber({}, { message: 'Monthly fee must be a number' })
  @Min(0)
  monthlyFee: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUBSCRIPTION_STATUSES as unknown as string[], {
    message: `Status must be one of: ${SUBSCRIPTION_STATUSES.join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must be YYYY-MM-DD' })
  startedOn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28, { message: 'Use a billing day of 28 or lower so every month has it' })
  billingDay?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Next due date must be YYYY-MM-DD' })
  nextDueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
