import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Get('my')
  @Roles('STUDENT')
  async getMyAttempts(@CurrentUser('id') userId: string) {
    return this.attemptsService.getMyAttempts(userId);
  }

  @Post('start')
  @Roles('STUDENT')
  async start(
    @CurrentUser('id') userId: string,
    @Body() dto: StartAttemptDto,
  ) {
    return this.attemptsService.start(userId, dto);
  }

  @Post(':id/answer')
  @Roles('STUDENT')
  async saveAnswer(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.attemptsService.saveAnswer(id, userId, dto);
  }

  @Post(':id/submit')
  @Roles('STUDENT')
  async submit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.submit(id, userId);
  }

  @Get(':id')
  async getAttempt(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getAttemptForStudent(id, userId);
  }

  @Get(':id/result')
  async getResult(@Param('id') id: string) {
    return this.attemptsService.getResult(id);
  }

  @Get(':id/review')
  async getAnswerReview(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.attemptsService.getAnswerReview(id, userId, role);
  }

  @Patch(':id/score')
  @Roles('TEACHER')
  async updateScore(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateScoreDto,
  ) {
    return this.attemptsService.updateScore(id, userId, dto.score);
  }

  @Patch(':id/feedback')
  @Roles('TEACHER')
  async updateAttemptFeedback(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.attemptsService.updateAttemptFeedback(id, userId, dto.feedback);
  }

  @Get(':id/exit-logs')
  @Roles('TEACHER')
  async getExitLogs(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getExitLogs(id, userId);
  }

  @Post(':id/exit-log')
  @Roles('STUDENT')
  async logExit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.logExit(id, userId);
  }

  @Post(':id/return-log')
  @Roles('STUDENT')
  async logReturn(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.logReturn(id, userId);
  }

  @Get()
  @Roles('TEACHER')
  async getAttemptsForExam(
    @Query('examId') examId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getAttemptsForExam(examId, userId);
  }
}
