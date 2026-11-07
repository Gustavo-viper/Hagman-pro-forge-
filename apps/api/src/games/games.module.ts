import { Module } from '@nestjs/common';
import { UniversesModule } from '../universes/universes.module.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';

@Module({ imports: [UniversesModule], controllers: [GamesController], providers: [GamesService] })
export class GamesModule {}
