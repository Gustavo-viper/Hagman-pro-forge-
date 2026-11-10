import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { adminReasonSchema, type AdminReasonInput } from '@fandom/schemas';
import type { AdminReferral, ReferralSummary } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ReferralsService } from './referrals.service.js';

@Controller({ version: '1' })
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  /** The signed-in user's invite link, progress and discount. */
  @Get('me/referrals')
  mine(@CurrentUser() user: AuthenticatedUser): Promise<ReferralSummary> {
    return this.referrals.summary(user);
  }

  @Roles('admin', 'support')
  @Get('admin/users/:id/referrals')
  forUser(@Param('id', ParseUUIDPipe) id: string): Promise<{ discountPercent: number; items: AdminReferral[] }> {
    return this.referrals.forUser(id);
  }

  @Roles('admin')
  @Post('admin/referrals/:id/revoke')
  @HttpCode(204)
  revoke(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(adminReasonSchema)) body: AdminReasonInput,
    @Req() req: Request,
  ): Promise<void> {
    return this.referrals.revoke(me, id, body.reason, req.ip ?? null);
  }
}
