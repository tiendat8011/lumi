import { IsEnum, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class GoogleLoginDto {
  @IsString()
  credential!: string;

  @IsEnum(Role)
  role!: Role;
}
