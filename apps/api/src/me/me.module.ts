import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { UniversesModule } from '../universes/universes.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { StatsService } from './stats.service.js';

@Module({ imports: [UniversesModule, AuditModule], controllers: [MeController], providers: [MeService, StatsService] })
export class MeModule {}
