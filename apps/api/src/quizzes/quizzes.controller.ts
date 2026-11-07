import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  quizAttemptSchema,
  rankingQuerySchema,
  setIdentitySchema,
  universeSlugSchema,
  type QuizAttemptInput,
  type RankingQuery,
  type SetIdentityInput,
} from '@fandom/schemas';
import type { QuizAttemptResult, QuizDetail, QuizProgress, QuizSummary, RankingEntry, UniverseMembership } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { QuizzesService } from './quizzes.service.js';

const slugPipe = new ZodPipe(universeSlugSchema);

@Controller({ version: '1' })
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Public()
  @Get('universes/:slug/quizzes')
  async list(@Param('slug', slugPipe) slug: string): Promise<{ items: QuizSummary[] }> {
    return { items: await this.quizzes.list(slug) };
  }

  @Get('universes/:slug/quiz-progress')
  async progress(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<{ items: QuizProgress[] }> {
    return { items: await this.quizzes.progress(user, slug) };
  }

  @Public()
  @Get('universes/:slug/ranking')
  async ranking(
    @Param('slug', slugPipe) slug: string,
    @Query(new ZodPipe(rankingQuerySchema)) q: RankingQuery,
  ): Promise<{ period: RankingQuery['period']; items: RankingEntry[] }> {
    return { period: q.period, items: await this.quizzes.ranking(slug, q) };
  }

  @Put('universes/:slug/identity')
  identity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug', slugPipe) slug: string,
    @Body(new ZodPipe(setIdentitySchema)) body: SetIdentityInput,
  ): Promise<UniverseMembership> {
    return this.quizzes.setIdentity(user, slug, body.key);
  }

  @Public()
  @Get('quizzes/:id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<QuizDetail> {
    return this.quizzes.detail(id);
  }

  @Throttle({ default: { limit: () => Number(process.env.QUIZ_RATE_LIMIT_MAX ?? 20), ttl: 60_000 } })
  @Post('quizzes/:id/attempts')
  attempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(quizAttemptSchema)) body: QuizAttemptInput,
  ): Promise<QuizAttemptResult> {
    return this.quizzes.attempt(user, id, body);
  }
}
