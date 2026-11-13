import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { GradingMode } from '@prisma/client';

export class CreateExamDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsInt()
  @Min(60)
  durationSeconds!: number;

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsDateString()
  availableUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsBoolean()
  showResultImmediately?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @IsOptional()
  @IsString()
  accessCode?: string;

  @IsOptional()
  @IsEnum(GradingMode)
  gradingMode?: GradingMode;

  @IsOptional()
  @IsBoolean()
  allowFileSubmission?: boolean;
}
