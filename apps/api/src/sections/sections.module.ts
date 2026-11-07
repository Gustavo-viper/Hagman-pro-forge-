import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { UniversesModule } from '../universes/universes.module.js';
import { EventRoomController } from './event-room.controller.js';
import { EventRoomService } from './event-room.service.js';
import { ForumService } from './forum.service.js';
import { SectionsController } from './sections.controller.js';
import { SectionsService } from './sections.service.js';

@Module({ imports: [UniversesModule, AuditModule], controllers: [SectionsController, EventRoomController], providers: [SectionsService, ForumService, EventRoomService] })
export class SectionsModule {}
