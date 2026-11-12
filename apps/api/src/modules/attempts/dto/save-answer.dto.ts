import { IsString } from 'class-validator';

export class SaveAnswerDto {
  @IsString()
  examQuestionId!: string;

  @IsString()
  selectedOptionId!: string;
}
