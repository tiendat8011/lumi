import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  examId!: string;

  @IsString()
  classroomId!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
