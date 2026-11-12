import { IsString, MinLength } from 'class-validator';

export class CreateClassroomDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
