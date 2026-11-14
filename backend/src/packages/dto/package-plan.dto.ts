import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Doctor/admin plans the next sitting date and/or corrects the expiry. Null clears. */
export class UpdatePackagePlanDto {
  /** Which treatment's next sitting (needed when the package has several). */
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @Matches(DATE, { message: 'Next sitting must be a date (YYYY-MM-DD)' })
  plannedNextSitting?: string | null;

  @IsOptional()
  @Matches(DATE, { message: 'Expiry must be a date (YYYY-MM-DD)' })
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

/** The doctor/clinic caused the delay: extend the package, no charge to the patient. */
export class DoctorDelayDto {
  @IsInt({ message: 'Days must be a whole number' })
  @Min(1, { message: 'Extend by at least 1 day' })
  @Max(365)
  days: number;

  @IsString()
  @IsNotEmpty({ message: 'Give a reason for the delay' })
  @MaxLength(300)
  note: string;
}

/** The patient missed it: the package lapses and the remaining sittings are forfeited. */
export class PatientLapseDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateHolidayDto {
  @Matches(DATE, { message: 'Holiday must be a date (YYYY-MM-DD)' })
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Name the holiday' })
  @MaxLength(100)
  name: string;
}
