import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { AttemptLifecycleService } from './attempt-lifecycle.service';

// PrismaService and NotificationEvents come from global modules.
@Module({
  providers: [GradingService, AttemptLifecycleService],
  exports: [GradingService, AttemptLifecycleService],
})
export class GradingModule {}
