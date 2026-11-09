import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ContestsService } from './contests.service.js';
import { DrawsService } from './draws.service.js';
import { PrizesController } from './prizes.controller.js';
import { PrizesService } from './prizes.service.js';

@Module({ imports: [AuditModule], controllers: [PrizesController], providers: [DrawsService, ContestsService, PrizesService] })
export class PrizesModule {}
