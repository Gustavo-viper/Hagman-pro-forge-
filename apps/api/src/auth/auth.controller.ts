import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { isLocale } from '@fandom/shared';
import {
  confirmPasswordResetSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  verifyEmailSchema,
  type ConfirmPasswordResetInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type VerifyEmailInput,
} from '@fandom/schemas';
import type { AuthSessionResponse } from '@fandom/types';
import { CurrentUser, Public } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AuthService, type ClientMeta } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';

/** Stricter per-IP limit for credential endpoints (AUTH_RATE_LIMIT_MAX per minute, default 10). */
const strict = { default: { limit: () => Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10), ttl: 60_000 } };

const meta = (req: Request): ClientMeta => ({
  ip: req.ip ?? null,
  userAgent: req.headers['user-agent'] ?? null,
  requestId: (req.headers['x-request-id'] as string | undefined) ?? null,
});

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(strict)
  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Req() req: Request): Promise<AuthSessionResponse> {
    const lang = req.headers['accept-language']?.split(',')[0]?.trim();
    const locale = isLocale(lang) ? lang : lang?.toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
    return this.auth.register(body, meta(req), locale);
  }

  @Public()
  @Throttle(strict)
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Req() req: Request): Promise<AuthSessionResponse> {
    return this.auth.login(body, meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) body: RefreshInput, @Req() req: Request): Promise<AuthSessionResponse> {
    return this.auth.refresh(body.refreshToken, meta(req));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user);
  }

  @Throttle(strict)
  @Post('email-verification')
  @HttpCode(202)
  async resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.requestEmailVerification(user);
  }

  @Public()
  @Throttle(strict)
  @Post('email-verification/confirm')
  @HttpCode(204)
  async verifyEmail(@Body(new ZodPipe(verifyEmailSchema)) body: VerifyEmailInput, @Req() req: Request): Promise<void> {
    await this.auth.verifyEmail(body.token, meta(req));
  }

  @Public()
  @Throttle(strict)
  @Post('password-reset')
  @HttpCode(202)
  async forgotPassword(@Body(new ZodPipe(forgotPasswordSchema)) body: ForgotPasswordInput): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(strict)
  @Post('password-reset/confirm')
  @HttpCode(204)
  async resetPassword(@Body(new ZodPipe(confirmPasswordResetSchema)) body: ConfirmPasswordResetInput, @Req() req: Request): Promise<void> {
    await this.auth.resetPassword(body, meta(req));
  }
}
