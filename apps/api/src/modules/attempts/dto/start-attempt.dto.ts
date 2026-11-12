import { IsString, IsOptional } from 'class-validator';

export class StartAttemptDto {
  @IsString()
  examId!: string;

  @IsOptional()
  @IsString()
  assignmentId?: string;
}
