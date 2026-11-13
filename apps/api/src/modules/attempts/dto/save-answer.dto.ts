import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { UUID_REGEX } from '../../../common/pipes/uuid.pipe';

export const SHORT_TEXT_MAX = 1000;
export const ESSAY_TEXT_MAX = 20000;

/**
 * Exactly one of selectedOptionId, selectedOptionIds and text, depending on
 * the question type. The service checks that against the snapshot.
 */
export class SaveAnswerDto {
  @Matches(UUID_REGEX, { message: 'examQuestionId must be a UUID' })
  examQuestionId!: string;

  /** MCQ, TRUE_FALSE */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  selectedOptionId?: string;

  /** MCQ_MULTI; an empty array clears the selection */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  selectedOptionIds?: string[];

  /** SHORT_ANSWER, FILL_BLANK (1,000 characters), ESSAY (20,000) */
  @IsOptional()
  @IsString()
  @MaxLength(ESSAY_TEXT_MAX)
  text?: string;
}
