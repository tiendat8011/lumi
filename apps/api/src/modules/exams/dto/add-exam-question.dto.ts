import { IsString, IsInt, Min } from 'class-validator';

export class AddExamQuestionDto {
  @IsString()
  questionId!: string;

  @IsInt()
  @Min(1)
  points!: number;

  @IsInt()
  @Min(0)
  position!: number;
}
