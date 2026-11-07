import type { StaffRole } from '@fandom/shared';

export interface AccessTokenClaims {
  /** User id. */
  sub: string;
  /** Session id (auth_sessions.id) — lets logout revoke access tokens immediately. */
  sid: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  roles: StaffRole[];
  /** Universe ids where the user is universe_moderator. */
  moderatedUniverseIds: string[];
  sessionId: string;
}
