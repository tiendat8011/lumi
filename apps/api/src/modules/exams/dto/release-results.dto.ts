import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ReleaseResultsDto {
  // Keep the raw value: implicit conversion would turn any string, even
  // "false", into true.
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['release'])
  @IsBoolean()
  release!: boolean;
}
