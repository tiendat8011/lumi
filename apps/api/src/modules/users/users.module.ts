import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { StudentAccountsService } from './student-accounts.service';

@Module({
  providers: [UsersService, StudentAccountsService],
  exports: [UsersService, StudentAccountsService],
})
export class UsersModule {}
