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
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { JoinClassroomDto } from './dto/join-classroom.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  @Roles('TEACHER')
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateClassroomDto,
  ) {
    return this.classroomsService.create(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.classroomsService.findAllForUser(userId, role);
  }

  @Post('join')
  @Roles('STUDENT')
  async joinByCode(
    @CurrentUser('id') userId: string,
    @Body() dto: JoinClassroomDto,
  ) {
    return this.classroomsService.joinByCode(userId, dto.joinCode);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.classroomsService.findById(id);
  }

  @Patch(':id')
  @Roles('TEACHER')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateClassroomDto,
  ) {
    return this.classroomsService.update(id, userId, dto);
  }

  @Delete(':id')
  @Roles('TEACHER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.classroomsService.delete(id, userId);
  }

  @Patch(':id/archive')
  @Roles('TEACHER')
  async archive(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.classroomsService.archive(id, userId);
  }

  @Patch(':id/unarchive')
  @Roles('TEACHER')
  async unarchive(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.classroomsService.unarchive(id, userId);
  }

  @Post(':id/join')
  @Roles('STUDENT')
  async join(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: JoinClassroomDto,
  ) {
    return this.classroomsService.join(id, userId, dto.joinCode);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    return this.classroomsService.getMembers(id);
  }

  @Delete(':id/members/:memberId')
  @Roles('TEACHER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.classroomsService.removeMember(id, memberId, userId);
  }
}
