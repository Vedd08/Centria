import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const QUEUE_STATUSES = [
  'WAITING',
  'WITH_DOCTOR',
  'AWAITING_SERVICE',
  'IN_SERVICE',
  'COMPLETED',
  'CANCELLED',
] as const;

export class UpdateQueueStatusDto {
  @IsString()
  @IsIn(QUEUE_STATUSES as unknown as string[], {
    message: `Status must be one of: ${QUEUE_STATUSES.join(', ')}`,
  })
  @IsNotEmpty()
  status: string;

  /** Reception/admin can hand a waiting patient to a different doctor. */
  @IsOptional()
  @IsString()
  doctorId?: string;
}
