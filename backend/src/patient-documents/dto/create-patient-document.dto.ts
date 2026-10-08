import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const CATEGORIES = ['LAB_REPORT', 'SCAN_IMAGE', 'PRESCRIPTION_SCAN', 'DISCHARGE_SUMMARY', 'OTHER'];

// multipart/form-data fields arrive as strings — this DTO validates the non-file fields
// sent alongside the uploaded file.
export class CreatePatientDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'Patient selection is required' })
  patientId: string;

  @IsString()
  @IsIn(CATEGORIES, { message: `Category must be one of: ${CATEGORIES.join(', ')}` })
  category: string;

  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  visitId?: string;

  @IsOptional()
  @IsString()
  admissionId?: string;
}
