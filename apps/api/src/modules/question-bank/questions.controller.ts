import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('questions')
@Roles('TEACHER')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  // --- Categories ---

  @Post('categories')
  async createCategory(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.questionsService.createCategory(userId, dto);
  }

  @Get('categories')
  async getCategories(@CurrentUser('id') userId: string) {
    return this.questionsService.getCategories(userId);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.questionsService.deleteCategory(id, userId);
  }

  // --- Questions ---

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionsService.create(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto & {
      search?: string;
      categoryId?: string;
      difficulty?: string;
      type?: string;
    },
  ) {
    return this.questionsService.findAll(userId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.questionsService.findById(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.questionsService.delete(id, userId);
  }
}
