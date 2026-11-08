import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { onboardingSchema, updatePreferencesSchema, usernameSchema, type OnboardingInput, type UpdatePreferencesInput } from '@fandom/schemas';
import type { DashboardResponse, MeResponse, PlayerStats } from '@fandom/types';
import { CurrentUser, RequiresPlan } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { MeService } from './me.service.js';
import { StatsService } from './stats.service.js';

@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly statsService: StatsService,
  ) {}

  /** Detailed statistics: a Fandom Plus perk (premium_required otherwise). */
  @RequiresPlan('plus')
  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser): Promise<PlayerStats> {
    return this.statsService.stats(user);
  }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.me.me(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<DashboardResponse> {
    return this.me.dashboard(user);
  }

  @Get('username-availability')
  async usernameAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodPipe(z.object({ username: usernameSchema }))) q: { username: string },
  ): Promise<{ username: string; available: boolean }> {
    return { username: q.username, available: await this.me.usernameAvailable(q.username, user.id) };
  }

  @Post('onboarding')
  onboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(onboardingSchema)) body: OnboardingInput,
    @Req() req: Request,
  ): Promise<MeResponse> {
    return this.me.completeOnboarding(user, body, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: (req.headers['x-request-id'] as string | undefined) ?? null,
    });
  }

  @Patch('preferences')
  preferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(updatePreferencesSchema)) body: UpdatePreferencesInput,
  ): Promise<MeResponse> {
    return this.me.updatePreferences(user, body);
  }
}
