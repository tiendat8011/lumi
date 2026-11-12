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

  @Get()
  async findByClassroom(
    @Query('classroomId') classroomId: string,
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
