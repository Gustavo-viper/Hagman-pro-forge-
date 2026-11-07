import { Module } from '@nestjs/common';
import { UniversesModule } from '../universes/universes.module.js';
import { ForumService } from './forum.service.js';
import { SectionsController } from './sections.controller.js';
import { SectionsService } from './sections.service.js';

@Module({ imports: [UniversesModule], controllers: [SectionsController], providers: [SectionsService, ForumService] })
export class SectionsModule {}
