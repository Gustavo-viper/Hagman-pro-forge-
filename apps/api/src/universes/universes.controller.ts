import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { officialThemeSchema, universeSlugSchema, youtubeId, type OfficialThemeInput } from '@fandom/schemas';
import type { UniverseMembership, UniverseSummary } from '@fandom/types';
import { AppError } from '../common/app-error.js';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import { UniversesService } from './universes.service.js';

const slugPipe = new ZodPipe(universeSlugSchema);

@Controller({ path: 'universes', version: '1' })
export class UniversesController {
  constructor(
    private readonly universes: UniversesService,
    private readonly db: DatabaseService,
  ) {}

  @Public()
  @Get()
  async list(): Promise<{ items: UniverseSummary[] }> {
    return { items: await this.universes.listActive() };
  }

  @Public()
  @Get(':slug')
  get(@Param('slug', slugPipe) slug: string) {
    return this.universes.getActive(slug);
  }

  /** Staff: official theme song (YouTube link from the rights holder) or null to remove it. */
  @Roles('admin', 'editor')
  @Put(':slug/official-theme')
  setOfficialTheme(@Param('slug', slugPipe) slug: string, @Body(new ZodPipe(officialThemeSchema)) body: OfficialThemeInput): Promise<UniverseSummary> {
    const t = body.theme;
    return this.universes.setOfficialTheme(slug, t ? { youtubeId: youtubeId(t.url)!, title: t.title, artist: t.artist || null } : null);
  }

  @Post(':slug/membership')
  async join(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<UniverseMembership> {
    const profile = await this.db.one<{ done: boolean }>(
      'SELECT onboarding_completed_at IS NOT NULL AS done FROM profiles WHERE user_id = $1',
      [user.id],
    );
    if (!profile?.done) throw AppError.forbidden('onboarding_required', 'Complete onboarding first');
    return this.universes.join(user.id, slug);
  }

  @Delete(':slug/membership')
  @HttpCode(204)
  async leave(@CurrentUser() user: AuthenticatedUser, @Param('slug', slugPipe) slug: string): Promise<void> {
    await this.universes.leave(user.id, slug);
  }
}
