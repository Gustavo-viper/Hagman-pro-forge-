import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { checkoutSchema, confirmPaymentSchema, type CheckoutInput, type ConfirmPaymentInput } from '@fandom/schemas';
import type { BillingConfig, CheckoutResponse, ConfirmPaymentResponse, SubscriptionDetails, TrialStatus } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { BillingService } from './billing.service.js';

@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('config')
  config(): BillingConfig {
    return this.billing.config();
  }

  @Throttle({ default: { limit: () => Number(process.env.CHECKOUT_RATE_LIMIT_MAX ?? 10), ttl: 60_000 } })
  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body(new ZodPipe(checkoutSchema)) body: CheckoutInput): Promise<CheckoutResponse> {
    return this.billing.checkout(user, body);
  }

  @Post('confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: AuthenticatedUser, @Body(new ZodPipe(confirmPaymentSchema)) body: ConfirmPaymentInput): Promise<ConfirmPaymentResponse> {
    return this.billing.confirm(user, body);
  }

  @Get('subscription')
  details(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDetails> {
    return this.billing.details(user);
  }

  @Post('subscription/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDetails> {
    return this.billing.cancel(user);
  }

  @Get('trial')
  trial(@CurrentUser() user: AuthenticatedUser): Promise<TrialStatus> {
    return this.billing.trialStatus(user);
  }

  @Throttle({ default: { limit: () => Number(process.env.CHECKOUT_RATE_LIMIT_MAX ?? 10), ttl: 60_000 } })
  @Post('trial')
  @HttpCode(200)
  startTrial(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDetails> {
    return this.billing.startTrial(user);
  }

  @Post('subscription/reactivate')
  @HttpCode(200)
  reactivate(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDetails> {
    return this.billing.reactivate(user);
  }

  /** InfinitePay notification endpoint (token in the URL; every event re-verified with the provider). */
  @Public()
  @SkipThrottle()
  @Post('webhooks/infinitepay')
  @HttpCode(200)
  async webhook(@Query('token') token: string | undefined, @Body() body: unknown, @Req() req: Request): Promise<{ received: true; outcome: string }> {
    const payload = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const outcome = await this.billing.handleWebhook(token, payload, { ip: req.ip ?? null });
    return { received: true, outcome };
  }
}
