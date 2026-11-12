import { IsString } from 'class-validator';

export class UpdateFeedbackDto {
  @IsString()
  feedback!: string;
}
