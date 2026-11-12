import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('exams')
@Roles('TEACHER')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExamDto,
  ) {
    return this.examsService.create(userId, dto);
  }

  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    return this.examsService.findAllForOwner(userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.examsService.findByIdForOwner(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.update(id, userId, dto);
  }

  @Post(':id/questions')
  async addQuestion(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddExamQuestionDto,
  ) {
    return this.examsService.addQuestion(id, userId, dto);
  }

  @Delete(':id/questions/:eqId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeQuestion(
    @Param('id') id: string,
    @Param('eqId') eqId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.examsService.removeQuestion(id, eqId, userId);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.examsService.publish(id, userId);
  }

  @Patch(':id/release-results')
  async releaseResults(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('release') release: boolean,
  ) {
    return this.examsService.releaseResults(id, userId, release ?? true);
  }

  @Post(':id/regrade')
  @HttpCode(HttpStatus.OK)
  async regrade(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.examsService.regrade(id, userId);
  }
}
