import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  // 8 characters, the same minimum RegisterDto enforces. A reset must not be a
  // way to set a password weaker than registration allows.
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
