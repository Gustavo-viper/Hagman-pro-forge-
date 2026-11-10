import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';

@Module({ imports: [AuditModule], controllers: [ReferralsController], providers: [ReferralsService], exports: [ReferralsService] })
export class ReferralsModule {}
