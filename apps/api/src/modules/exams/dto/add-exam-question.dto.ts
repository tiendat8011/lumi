import { IsInt, Matches, Min } from 'class-validator';
import { UUID_REGEX } from '../../../common/pipes/uuid.pipe';

export class AddExamQuestionDto {
  @Matches(UUID_REGEX, { message: 'questionId must be a UUID' })
  questionId!: string;

  @IsInt()
  @Min(1)
  points!: number;

  @IsInt()
  @Min(0)
  position!: number;
}
