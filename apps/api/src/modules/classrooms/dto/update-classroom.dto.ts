import { IsString, IsOptional } from 'class-validator';

export class UpdateClassroomDto {
  @IsOptional()
  @IsString()
  name?: string;
}
