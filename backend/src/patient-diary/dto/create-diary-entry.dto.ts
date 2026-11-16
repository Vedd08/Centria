import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Sent as multipart form fields alongside the `photos` files. */
export class CreateDiaryEntryDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient is required' })
  patientId: string;

  /** Today's queue entry, when written during a visit. */
  @IsOptional()
  @IsString()
  queueId?: string;

  /** The package treatment line this entry is about (sitting of a package). */
  @IsOptional()
  @IsString()
  purchaseItemId?: string;

  /** Free label when it isn't a package treatment (e.g. a one-off procedure). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  treatmentName?: string;

  @IsOptional()
  @IsIn(['BETTER', 'SAME', 'WORSE', ''], { message: 'Progress must be Better, Same or Worse' })
  progress?: string;

  @IsString()
  @IsNotEmpty({ message: 'Write how the patient is recovering' })
  @MaxLength(2000)
  notes: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string;
}
