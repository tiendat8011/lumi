import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AttemptsService } from './attempts.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
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

  /**
   * 201 for a new attempt, 200 for a resumed one. Nest applies one fixed
   * status per route, so this route sends its own response, in the same
   * envelope the TransformInterceptor produces. Errors still go through the
   * exception filter.
   */
  @Post('start')
  @Roles('STUDENT')
  async start(
    @CurrentUser('id') userId: string,
    @Body() dto: StartAttemptDto,
    @Res() reply: FastifyReply,
  ) {
    const { created, attempt } = await this.attemptsService.start(userId, dto);
    reply.status(created ? 201 : 200).send({ success: true, data: attempt });
  }

  @Post(':id/answer')
  @Roles('STUDENT')
  async saveAnswer(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.attemptsService.saveAnswer(id, userId, dto);
  }

  @Post(':id/submit')
  @Roles('STUDENT')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.submit(id, userId);
  }

  @Get(':id')
  @Roles('STUDENT')
  async getAttempt(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getAttemptForStudent(id, userId);
  }

  // Any role: the service allows the attempt owner (masked) or the exam owner.
  @Get(':id/result')
  async getResult(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getResult(id, userId);
  }

  // Any role: the service allows the exam owner, or the attempt owner when
  // results are visible.
  @Get(':id/review')
  async getAnswerReview(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getAnswerReview(id, userId);
  }

  @Patch(':id/score')
  @Roles('TEACHER')
  async updateScore(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateScoreDto,
  ) {
    return this.attemptsService.updateScore(id, userId, dto.score);
  }

  @Patch(':id/feedback')
  @Roles('TEACHER')
  async updateAttemptFeedback(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.attemptsService.updateAttemptFeedback(id, userId, dto.feedback);
  }

  @Get(':id/exit-logs')
  @Roles('TEACHER')
  async getExitLogs(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getExitLogs(id, userId);
  }

  @Post(':id/exit-log')
  @Roles('STUDENT')
  async logExit(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.logExit(id, userId);
  }

  @Post(':id/return-log')
  @Roles('STUDENT')
  async logReturn(
    @Param('id', UuidPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.logReturn(id, userId);
  }

  @Get()
  @Roles('TEACHER')
  async getAttemptsForExam(
    @Query('examId', UuidPipe) examId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attemptsService.getAttemptsForExam(examId, userId);
  }
}
