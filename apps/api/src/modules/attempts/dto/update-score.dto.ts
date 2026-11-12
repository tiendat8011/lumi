import { IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';

export class UpdateScoreDto {
  @IsNumber()
  @Min(0)
  @Max(10)
  score!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
