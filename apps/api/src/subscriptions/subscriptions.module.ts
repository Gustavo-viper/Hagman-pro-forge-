import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service.js';

@Global()
@Module({ providers: [EntitlementsService], exports: [EntitlementsService] })
export class SubscriptionsModule {}
