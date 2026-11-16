import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
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
  @MaxLength(500)
  note?: string;

  /** CALL_BACK: when to call again (required). BOOKED: the date the sitting is booked for. */
  @ValidateIf((o) => o.outcome === 'CALL_BACK' || o.callBackOn != null)
  @IsNotEmpty({ message: 'callBackOn is required when outcome is CALL_BACK' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'callBackOn must be in YYYY-MM-DD format' })
  callBackOn?: string;

  /** BOOKED package sitting: time of the slot, HH:MM. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'bookedTime must be HH:MM' })
  bookedTime?: string;
}
