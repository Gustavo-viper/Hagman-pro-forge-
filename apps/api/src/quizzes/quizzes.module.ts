import { Module } from '@nestjs/common';
import { UniversesModule } from '../universes/universes.module.js';
import { QuizzesController } from './quizzes.controller.js';
import { QuizzesService } from './quizzes.service.js';

@Module({ imports: [UniversesModule], controllers: [QuizzesController], providers: [QuizzesService] })
export class QuizzesModule {}
