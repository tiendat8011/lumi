import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  Min,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOptionDto {
  @IsString()
  content!: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsInt()
  @Min(0)
  position!: number;
}

export enum QuestionType {
  MCQ = 'MCQ',
  MCQ_MULTI = 'MCQ_MULTI',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  FILL_BLANK = 'FILL_BLANK',
  ESSAY = 'ESSAY',
  LISTENING_MCQ = 'LISTENING_MCQ',
  LISTENING_FILL = 'LISTENING_FILL',
  READING_MCQ = 'READING_MCQ',
  READING_FILL = 'READING_FILL',
  SPEAKING = 'SPEAKING',
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export class CreateQuestionDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  audioUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  passage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];
}
