import type { StaffRole } from '@fandom/shared';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  sessionId: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  roles: StaffRole[];
  /** Universe ids where the user is universe_moderator. */
  moderatedUniverseIds: string[];
}
