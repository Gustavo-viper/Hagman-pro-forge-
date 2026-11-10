import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ReferralsModule } from '../referrals/referrals.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { InfinitePayClient } from './infinitepay.client.js';

@Module({
  imports: [AuditModule, ReferralsModule],
  controllers: [BillingController],
  providers: [BillingService, InfinitePayClient],
})
export class BillingModule {}
