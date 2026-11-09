import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import {
  contestCreateSchema,
  contestEntryFieldsSchema,
  contestUpdateSchema,
  contestVoteSchema,
  contestWinnerSchema,
  drawCreateSchema,
  drawRunSchema,
  drawUpdateSchema,
  entryReviewSchema,
  prizeCodeSchema,
  type ContestCreateInput,
  type ContestEntryFields,
  type ContestUpdateInput,
  type DrawCreateInput,
  type DrawUpdateInput,
} from '@fandom/schemas';
import type { AdminContest, AdminDraw, ContestDetail, ContestSummary, DrawSummary, PrizeItem } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, OptionalAuth, OptionalUser, Public, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ContestsService, MAX_UPLOAD_BYTES, type UploadedImage } from './contests.service.js';
import { DrawsService } from './draws.service.js';
import { PrizesService } from './prizes.service.js';

const slugPipe = new ZodPipe(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80));
const uploadLimit = { default: { limit: () => Number(process.env.UPLOAD_RATE_LIMIT_MAX ?? 10), ttl: 60 * 60_000 } };

@Controller({ version: '1' })
export class PrizesController {
  constructor(
    private readonly draws: DrawsService,
    private readonly contests: ContestsService,
    private readonly prizes: PrizesService,
  ) {}

  // ---------------------------------------------------------------- draws
  @OptionalAuth()
  @Get('draws')
  async listDraws(@OptionalUser() user: AuthenticatedUser | null): Promise<{ items: DrawSummary[] }> {
    return { items: await this.draws.list(user) };
  }

  @OptionalAuth()
  @Get('draws/:id')
  draw(@OptionalUser() user: AuthenticatedUser | null, @Param('id', ParseUUIDPipe) id: string): Promise<DrawSummary> {
    return this.draws.detail(user, id);
  }

  @Post('draws/:id/entries')
  @HttpCode(200)
  enter(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<DrawSummary> {
    return this.draws.enter(user, id);
  }

  // ---------------------------------------------------------------- contests
  @Public()
  @Get('contests')
  async listContests(): Promise<{ items: ContestSummary[] }> {
    return { items: await this.contests.list() };
  }

  @OptionalAuth()
  @Get('contests/:slug')
  contest(@OptionalUser() user: AuthenticatedUser | null, @Param('slug', slugPipe) slug: string): Promise<ContestDetail> {
    return this.contests.detail(user, slug);
  }

  @Throttle(uploadLimit)
  @Post('contests/:slug/entries')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } }))
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug', slugPipe) slug: string,
    @Body(new ZodPipe(contestEntryFieldsSchema)) body: ContestEntryFields,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<ContestDetail> {
    return this.contests.submit(user, slug, body, file);
  }

  @Delete('contests/:slug/entries/mine')
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<ContestDetail> {
    return this.contests.withdraw(user, slug);
  }

  @Put('contests/:slug/vote')
  vote(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string, @Body(new ZodPipe(contestVoteSchema)) body: { entryId: string }): Promise<ContestDetail> {
    return this.contests.vote(user, slug, body.entryId);
  }

  /** Approved entries only; cross-origin so the web app (another site) can show them. */
  @Public()
  @Get('contest-entries/:id/image')
  async image(@Param('id', ParseUUIDPipe) id: string, @Query('size') size: string | undefined, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const data = await this.contests.image(id, size === 'thumb' ? 'thumb' : 'full');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return new StreamableFile(data, { type: 'image/webp', length: data.length });
  }

  // ---------------------------------------------------------------- my prizes
  @Get('me/prizes')
  async myPrizes(@CurrentUser() user: AuthenticatedUser): Promise<{ items: PrizeItem[] }> {
    return { items: await this.prizes.mine(user) };
  }

  // ---------------------------------------------------------------- admin
  @Roles('admin')
  @Get('admin/draws')
  async adminDraws(): Promise<{ items: AdminDraw[] }> {
    return { items: await this.draws.adminList() };
  }

  @Roles('admin')
  @Post('admin/draws')
  createDraw(@CurrentUser() u: AuthenticatedUser, @Body(new ZodPipe(drawCreateSchema)) body: DrawCreateInput): Promise<AdminDraw> {
    return this.draws.create(u, body);
  }

  @Roles('admin')
  @Patch('admin/draws/:id')
  updateDraw(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(drawUpdateSchema)) body: DrawUpdateInput): Promise<AdminDraw> {
    return this.draws.update(u, id, body);
  }

  @Roles('admin')
  @Post('admin/draws/:id/open')
  @HttpCode(200)
  openDraw(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminDraw> {
    return this.draws.open(u, id);
  }

  @Roles('admin')
  @Post('admin/draws/:id/cancel')
  @HttpCode(200)
  cancelDraw(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminDraw> {
    return this.draws.cancel(u, id);
  }

  @Roles('admin')
  @Post('admin/draws/:id/run')
  @HttpCode(200)
  runDraw(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(drawRunSchema)) body: { externalValue: string }): Promise<AdminDraw> {
    return this.draws.run(u, id, body.externalValue);
  }

  @Roles('admin')
  @Put('admin/prizes/:id/code')
  deliver(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(prizeCodeSchema)) body: { code: string }) {
    return this.prizes.deliver(u, id, body.code);
  }

  @Roles('admin', 'editor', 'global_moderator')
  @Get('admin/contests')
  async adminContests(): Promise<{ items: AdminContest[] }> {
    return { items: await this.contests.adminList() };
  }

  @Roles('admin', 'editor')
  @Post('admin/contests')
  createContest(@CurrentUser() u: AuthenticatedUser, @Body(new ZodPipe(contestCreateSchema)) body: ContestCreateInput): Promise<AdminContest> {
    return this.contests.create(u, body);
  }

  @Roles('admin', 'editor')
  @Patch('admin/contests/:id')
  updateContest(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(contestUpdateSchema)) body: ContestUpdateInput): Promise<AdminContest> {
    return this.contests.update(u, id, body);
  }

  @Roles('admin', 'editor')
  @Post('admin/contests/:id/publish')
  @HttpCode(200)
  publishContest(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminContest> {
    return this.contests.setStatus(u, id, 'published');
  }

  @Roles('admin', 'editor')
  @Post('admin/contests/:id/cancel')
  @HttpCode(200)
  cancelContest(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminContest> {
    return this.contests.setStatus(u, id, 'cancelled');
  }

  @Roles('admin', 'editor', 'global_moderator')
  @Post('admin/contest-entries/:id/review')
  @HttpCode(204)
  async review(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(entryReviewSchema)) body: { action: 'approve' | 'reject' }): Promise<void> {
    await this.contests.review(u, id, body.action);
  }

  @Roles('admin')
  @Post('admin/contests/:id/winner')
  @HttpCode(200)
  winner(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(contestWinnerSchema)) body: { entryId: string }): Promise<AdminContest> {
    return this.contests.declareWinner(u, id, body.entryId);
  }
}
