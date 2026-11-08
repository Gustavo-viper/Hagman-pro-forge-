import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createReplySchema,
  createTopicSchema,
  forumListSchema,
  reportSchema,
  sectionKeySchema,
  shelfUpdateSchema,
  universeSlugSchema,
  type CreateReplyInput,
  type CreateTopicInput,
  type ForumListInput,
  type ReportInput,
  type ShelfUpdateInput,
} from '@fandom/schemas';
import type { BookShelf, CursorPage, ForumTopicDetail, ForumTopicSummary, IdentityStanding, LoreEntry, MissionProgress, MissionSummary, UniverseEvent } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, OptionalAuth, OptionalUser, Public } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ForumService } from './forum.service.js';
import { SectionsService } from './sections.service.js';

const slugPipe = new ZodPipe(universeSlugSchema);
const sectionPipe = new ZodPipe(sectionKeySchema);
const limit = (env: string, def: number) => ({ default: { limit: () => Number(process.env[env] ?? def), ttl: 60_000 } });

@Controller({ version: '1' })
export class SectionsController {
  constructor(
    private readonly sections: SectionsService,
    private readonly forum: ForumService,
  ) {}

  // archive
  @Public()
  @Get('universes/:slug/archive/:section')
  async archive(@Param('slug', slugPipe) slug: string, @Param('section', sectionPipe) section: string): Promise<{ items: LoreEntry[] }> {
    return { items: await this.sections.archive(slug, section) };
  }

  // book shelf (personal reading list)
  @Get('universes/:slug/books/shelf')
  shelf(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<BookShelf> {
    return this.sections.shelf(user, slug);
  }

  @Throttle({ default: { limit: () => Number(process.env.FORUM_RATE_LIMIT_MAX ?? 60), ttl: 60_000 } })
  @Put('books/:entryId/shelf')
  setShelf(@CurrentUser() user: AuthenticatedUser, @Param('entryId', ParseUUIDPipe) entryId: string, @Body(new ZodPipe(shelfUpdateSchema)) body: ShelfUpdateInput) {
    return this.sections.setShelf(user, entryId, body.status);
  }

  // missions
  @Public()
  @Get('universes/:slug/missions')
  async missions(@Param('slug', slugPipe) slug: string): Promise<{ items: MissionSummary[] }> {
    return { items: await this.sections.missions(slug) };
  }

  @Get('universes/:slug/missions/progress')
  async missionProgress(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<{ items: MissionProgress[] }> {
    return { items: await this.sections.missionProgress(user, slug) };
  }

  @Post('missions/:id/claim')
  @HttpCode(200)
  claim(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sections.claimMission(user, id);
  }

  // events
  @Public()
  @Get('universes/:slug/events')
  async events(@Param('slug', slugPipe) slug: string): Promise<{ items: UniverseEvent[] }> {
    return { items: await this.sections.events(slug) };
  }

  @Get('universes/:slug/events/mine')
  async myEvents(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<{ items: string[] }> {
    return { items: await this.sections.myEvents(user, slug) };
  }

  @Post('events/:id/registration')
  register(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<UniverseEvent> {
    return this.sections.register(user, id);
  }

  @Delete('events/:id/registration')
  @HttpCode(204)
  async unregister(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.sections.unregister(user, id);
  }

  // house cup / faction standings
  @Public()
  @Get('universes/:slug/standings')
  async standings(@Param('slug', slugPipe) slug: string): Promise<{ items: IdentityStanding[] }> {
    return { items: await this.sections.standings(slug) };
  }

  // forum
  @OptionalAuth()
  @Get('universes/:slug/forum/:category')
  topics(
    @OptionalUser() user: AuthenticatedUser | null,
    @Param('slug', slugPipe) slug: string,
    @Param('category', sectionPipe) category: string,
    @Query(new ZodPipe(forumListSchema)) q: ForumListInput,
  ): Promise<CursorPage<ForumTopicSummary> & { scope: string | null }> {
    return this.forum.list(user, slug, category, q);
  }

  @Throttle(limit('FORUM_RATE_LIMIT_MAX', 10))
  @Post('universes/:slug/forum/:category')
  createTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug', slugPipe) slug: string,
    @Param('category', sectionPipe) category: string,
    @Body(new ZodPipe(createTopicSchema)) body: CreateTopicInput,
  ): Promise<ForumTopicDetail> {
    return this.forum.create(user, slug, category, body);
  }

  @OptionalAuth()
  @Get('forum/topics/:id')
  topic(@OptionalUser() user: AuthenticatedUser | null, @Param('id', ParseUUIDPipe) id: string): Promise<ForumTopicDetail> {
    return this.forum.topic(user, id);
  }

  @Throttle(limit('FORUM_RATE_LIMIT_MAX', 10))
  @Post('forum/topics/:id/replies')
  reply(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(createReplySchema)) body: CreateReplyInput): Promise<ForumTopicDetail> {
    return this.forum.reply(user, id, body);
  }

  @Delete('forum/topics/:id')
  @HttpCode(204)
  async deleteTopic(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.forum.deleteOwn(user, 'topic', id);
  }

  @Delete('forum/replies/:id')
  @HttpCode(204)
  async deleteReply(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.forum.deleteOwn(user, 'reply', id);
  }

  @Throttle(limit('FORUM_RATE_LIMIT_MAX', 10))
  @Post('reports')
  @HttpCode(202)
  async report(@CurrentUser() user: AuthenticatedUser, @Body(new ZodPipe(reportSchema)) body: ReportInput): Promise<void> {
    await this.forum.report(user, body);
  }
}
