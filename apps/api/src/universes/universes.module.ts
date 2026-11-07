import { Module } from '@nestjs/common';
import { UniversesController } from './universes.controller.js';
import { UniversesService } from './universes.service.js';

@Module({ controllers: [UniversesController], providers: [UniversesService], exports: [UniversesService] })
export class UniversesModule {}
