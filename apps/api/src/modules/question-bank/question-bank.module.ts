import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { QuestionSelectionService } from './question-selection.service';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, QuestionSelectionService],
  exports: [QuestionsService, QuestionSelectionService],
})
export class QuestionBankModule {}
