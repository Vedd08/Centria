import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { FollowUpKind, CallOutcome } from '../follow-ups.service';

export class LogCallDto {
  @IsNotEmpty()
  @IsString()
  patientId: string;

  @IsNotEmpty()
  @IsIn(['DOCTOR_FOLLOW_UP', 'PACKAGE_SITTING'])
  kind: FollowUpKind;

  @IsNotEmpty()
  @IsString()
  refId: string;

  @IsNotEmpty()
  @IsString()
  dueDate: string;

  @IsNotEmpty()
  @IsIn(['BOOKED', 'NO_ANSWER', 'DECLINED', 'CALL_BACK'], {
    message: 'outcome must be one of: BOOKED, NO_ANSWER, DECLINED, CALL_BACK',
  })
  outcome: CallOutcome;

  @IsOptional()
  @IsString()
  note?: string;

  @ValidateIf((o) => o.outcome === 'CALL_BACK')
  @IsNotEmpty({ message: 'callBackOn is required when outcome is CALL_BACK' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'callBackOn must be in YYYY-MM-DD format' })
  callBackOn?: string;
}
