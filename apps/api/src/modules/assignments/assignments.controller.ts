import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UuidPipe } from '../../common/pipes/uuid.pipe';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('TEACHER')
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentsService.create(userId, dto);
  }

  // classroomId is required: without the pipe a missing or malformed value
  // reached Prisma and surfaced as a 500 instead of a 400.
  @Get()
  async findByClassroom(
    @Query('classroomId', UuidPipe) classroomId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.assignmentsService.findByClassroom(classroomId, userId, role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.assignmentsService.findById(id);
  }

  @Patch(':id/close')
  @Roles('TEACHER')
  async close(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.assignmentsService.close(id, userId);
  }
}
