import { IsIn, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class UpdateCommissionRuleDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['Doctor', 'RM', 'Operator', 'ReferringDoctor'])
  role: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['percentage', 'fixed'])
  shareType: 'percentage' | 'fixed';

  @IsNumber()
  @Min(0)
  value: number;
}
