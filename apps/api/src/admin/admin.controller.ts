import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  resolveReportSchema,
  type ResolveReportInput,
  adminReasonSchema,
  adminUserListSchema,
  grantPlanSchema,
  type AdminReasonInput,
  type AdminUserListInput,
  type GrantPlanInput,
} from '@fandom/schemas';
import type { AdminReport, AdminStats, AdminUserDetails, AdminUserRow, CursorPage } from '@fandom/types';
import { z } from 'zod';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AdminService } from './admin.service.js';

/**
 * Forge Studios staff panel. Every route requires a staff role verified on the server
 * (super_admin always passes). Viewing: admin or support. Changes: admin only.
 */
@Controller({ path: 'admin', version: '1' })
@Roles('admin', 'support')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(): Promise<AdminStats> {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query(new ZodPipe(adminUserListSchema)) q: AdminUserListInput): Promise<CursorPage<AdminUserRow>> {
    return this.admin.listUsers(q);
  }

  @Get('users/:id')
  user(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetails> {
    return this.admin.user(id);
  }

  @Roles('admin')
  @Post('users/:id/grant-plan')
  @HttpCode(200)
  grant(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(grantPlanSchema)) body: GrantPlanInput,
    @Req() req: Request,
  ): Promise<AdminUserDetails> {
    return this.admin.grantPlan(me, id, body, req.ip ?? null);
  }

  @Roles('admin')
  @Post('users/:id/revoke-plan')
  @HttpCode(200)
  revoke(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(adminReasonSchema)) body: AdminReasonInput,
    @Req() req: Request,
  ): Promise<AdminUserDetails> {
    return this.admin.revokePlan(me, id, body.reason, req.ip ?? null);
  }

  @Roles('admin')
  @Post('users/:id/suspend')
  @HttpCode(200)
  suspend(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(adminReasonSchema)) body: AdminReasonInput,
    @Req() req: Request,
  ): Promise<AdminUserDetails> {
    return this.admin.setAccountStatus(me, id, 'suspended', body.reason, req.ip ?? null);
  }

  @Roles('admin')
  @Post('users/:id/reactivate')
  @HttpCode(200)
  reactivate(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(adminReasonSchema)) body: AdminReasonInput,
    @Req() req: Request,
  ): Promise<AdminUserDetails> {
    return this.admin.setAccountStatus(me, id, 'active', body.reason, req.ip ?? null);
  }

  @Roles('admin', 'support', 'global_moderator')
  @Get('reports')
  async reports(@Query(new ZodPipe(z.object({ status: z.enum(['open', 'resolved', 'dismissed']).default('open') }))) q: { status: 'open' | 'resolved' | 'dismissed' }): Promise<{ items: AdminReport[] }> {
    return { items: await this.admin.reports(q.status) };
  }

  @Roles('admin', 'global_moderator')
  @Post('reports/:id/resolve')
  @HttpCode(204)
  async resolve(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(resolveReportSchema)) body: ResolveReportInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.admin.resolveReport(me, id, body.action, body.note, req.ip ?? null);
  }
}
