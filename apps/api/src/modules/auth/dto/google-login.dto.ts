import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * Two client flows are supported:
 *  - `credential`:  an ID token, from Google's own rendered sign-in button.
 *  - `accessToken`: an OAuth access token, from the implicit flow a custom
 *                   button uses. Verified against the tokeninfo endpoint.
 *
 * Exactly one must be supplied; the service rejects the request otherwise.
 */
export class GoogleLoginDto {
  @IsOptional()
  @IsString()
  credential?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsEnum(Role)
  role!: Role;
}
