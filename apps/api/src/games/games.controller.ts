import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  dailySubmitSchema,
  gameLeaderboardQuerySchema,
  hangmanGuessSchema,
  speedAnswerSchema,
  universeSlugSchema,
  type DailySubmitInput,
  type GameLeaderboardQuery,
  type HangmanGuessInput,
  type SpeedAnswerInput,
} from '@fandom/schemas';
import type { DailyChallenge, GameLeaderboardEntry, GamesOverview, HangmanGame, SpeedRound, SurvivalRound } from '@fandom/types';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { GamesService } from './games.service.js';

const slugPipe = new ZodPipe(universeSlugSchema);
/** Guesses and speed answers are frequent by nature; still bounded per user/IP. */
const playLimit = { default: { limit: () => Number(process.env.GAME_RATE_LIMIT_MAX ?? 150), ttl: 60_000 } };
const startLimit = { default: { limit: () => Number(process.env.GAME_START_RATE_LIMIT_MAX ?? 30), ttl: 60_000 } };

@Controller({ version: '1' })
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('universes/:slug/games/me')
  overview(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<GamesOverview> {
    return this.games.overview(user, slug);
  }

  @Public()
  @Get('universes/:slug/games/leaderboard')
  async leaderboard(
    @Param('slug', slugPipe) slug: string,
    @Query(new ZodPipe(gameLeaderboardQuerySchema)) q: GameLeaderboardQuery,
  ): Promise<{ game: GameLeaderboardQuery['game']; items: GameLeaderboardEntry[] }> {
    return { game: q.game, items: await this.games.leaderboard(slug, q) };
  }

  // daily challenge
  @Get('universes/:slug/games/daily')
  daily(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<DailyChallenge> {
    return this.games.daily(user, slug);
  }

  @Throttle(startLimit)
  @Post('universes/:slug/games/daily')
  @HttpCode(200)
  submitDaily(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string, @Body(new ZodPipe(dailySubmitSchema)) body: DailySubmitInput): Promise<DailyChallenge> {
    return this.games.submitDaily(user, slug, body);
  }

  // speed round
  @Throttle(startLimit)
  @Post('universes/:slug/games/speed')
  startSpeed(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<SpeedRound> {
    return this.games.startSpeed(user, slug);
  }

  @Throttle(playLimit)
  @Post('games/speed/:id/answers')
  @HttpCode(200)
  answer(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(speedAnswerSchema)) body: SpeedAnswerInput): Promise<SpeedRound> {
    return this.games.answerSpeed(user, id, body);
  }

  @Post('games/speed/:id/finish')
  @HttpCode(200)
  finish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<SpeedRound> {
    return this.games.finishSpeedRound(user, id);
  }

  // survival (subscribers)
  @Throttle(startLimit)
  @Post('universes/:slug/games/survival')
  startSurvival(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<SurvivalRound> {
    return this.games.startSurvival(user, slug);
  }

  @Throttle(playLimit)
  @Post('games/survival/:id/answers')
  @HttpCode(200)
  answerSurvival(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(speedAnswerSchema)) body: SpeedAnswerInput): Promise<SurvivalRound> {
    return this.games.answerSurvival(user, id, body);
  }

  @Post('games/survival/:id/finish')
  @HttpCode(200)
  finishSurvival(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<SurvivalRound> {
    return this.games.finishSurvivalRound(user, id);
  }

  // hangman
  @Throttle(startLimit)
  @Post('universes/:slug/games/hangman')
  startHangman(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<HangmanGame> {
    return this.games.startHangman(user, slug);
  }

  @Get('games/hangman/:id')
  hangman(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<HangmanGame> {
    return this.games.hangman(user, id);
  }

  @Throttle(playLimit)
  @Post('games/hangman/:id/guesses')
  @HttpCode(200)
  guess(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(hangmanGuessSchema)) body: HangmanGuessInput): Promise<HangmanGame> {
    return this.games.guess(user, id, body.letter);
  }

  @Throttle(playLimit)
  @Post('games/hangman/:id/clues')
  @HttpCode(200)
  revealClue(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<HangmanGame> {
    return this.games.revealClue(user, id);
  }
}
