import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('classrooms/:id')
  @Roles('TEACHER')
  async getClassroomPerformance(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.analyticsService.getClassroomPerformance(id, userId);
  }

  @Get('exams/:id/distribution')
  @Roles('TEACHER')
  async getExamDistribution(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.analyticsService.getExamDistribution(id, userId);
  }

  @Get('exams/:id/questions')
  @Roles('TEACHER')
  async getExamQuestionStats(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.analyticsService.getExamQuestionStats(id, userId);
  }

  @Get('exams/:id/ranking')
  @Roles('TEACHER')
  async getExamRanking(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.analyticsService.getExamRanking(id, userId);
  }

  @Get('students/me/performance')
  @Roles('STUDENT')
  async getMyPerformance(@CurrentUser('id') userId: string) {
    return this.analyticsService.getStudentPerformance(userId);
  }

  @Get('students/:id/performance')
  @Roles('TEACHER')
  async getStudentPerformance(@Param('id') id: string) {
    return this.analyticsService.getStudentPerformance(id);
  }
}
