import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { UUID_REGEX } from '../../../common/pipes/uuid.pipe';

export class StartAttemptDto {
  @Matches(UUID_REGEX, { message: 'examId must be a UUID' })
  examId!: string;

  /** Optional: the server resolves the assignment when it is omitted. */
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'assignmentId must be a UUID' })
  assignmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accessCode?: string;
}
