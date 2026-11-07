import { Global, Module } from '@nestjs/common';
import { XpService } from './xp.service.js';

@Global()
@Module({ providers: [XpService], exports: [XpService] })
export class XpModule {}
