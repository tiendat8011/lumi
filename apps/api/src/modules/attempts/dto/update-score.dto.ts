import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateScoreDto {
  @IsNumber()
  @Min(0)
  @Max(10)
  score!: number;

  /** Accepted and validated; there is no column to store it yet. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
