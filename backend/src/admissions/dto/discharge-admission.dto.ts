import { IsNotEmpty, IsString } from 'class-validator';

export class DischargeAdmissionDto {
  @IsString()
  @IsNotEmpty({ message: 'Discharge summary is required' })
  dischargeSummary: string;
}
