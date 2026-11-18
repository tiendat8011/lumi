import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { DifficultyLevel, QuestionType } from './create-question.dto';

/**
 * The query of GET /questions.
 *
 * A class that extends PaginationQueryDto, not the intersection type
 * `PaginationQueryDto & { search?: string; ... }` this endpoint used to
 * declare. An intersection type has no runtime representation, so Nest emits
 * `Object` as the parameter's metatype, the global ValidationPipe finds no
 * class to instantiate and skips the parameter: nothing was validated and
 * `limit` reached Prisma as the string it arrived as. Every `@Query()` that
 * takes an object needs a single class.
 */
export class QuestionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;
}
