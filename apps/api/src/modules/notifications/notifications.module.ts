import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationEvents } from './notification-events.service';
import { RemindersService } from './reminders.service';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEvents, RemindersService],
  exports: [NotificationsService, NotificationEvents],
})
export class NotificationsModule {}
