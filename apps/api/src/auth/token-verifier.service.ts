import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, decodeProtectedHeader, errors, jwtVerify, type JWTPayload } from 'jose';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AppError } from '../common/app-error.js';
import type { AccessTokenClaims } from './auth.types.js';

interface SupabaseClaims extends JWTPayload {
  email?: string;
  role?: string;
  is_anonymous?: boolean;
  session_id?: string;
  user_metadata?: { email_verified?: boolean };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies Supabase Auth access tokens.
 *  - Asymmetric signing keys (RS256/ES256): verified against the project's JWKS
 *    endpoint ({SUPABASE_URL}/auth/v1/.well-known/jwks.json), cached by jose.
 *  - Legacy HS256: verified with SUPABASE_JWT_SECRET.
 * Issuer and audience are always checked; tokens for anonymous users are rejected.
 */
@Injectable()
export class TokenVerifierService {
  private readonly jwks?: ReturnType<typeof createRemoteJWKSet>;
  private readonly secret?: Uint8Array;
  private readonly issuer?: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.SUPABASE_URL) {
      const base = env.SUPABASE_URL.replace(/\/+$/, '');
      this.issuer = `${base}/auth/v1`;
      this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
        cooldownDuration: 30_000,
        cacheMaxAge: 10 * 60_000,
      });
    }
    if (env.SUPABASE_JWT_SECRET) this.secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    let payload: SupabaseClaims;
    try {
      const { alg } = decodeProtectedHeader(token);
      const options = {
        audience: this.env.SUPABASE_JWT_AUDIENCE,
        ...(this.issuer ? { issuer: this.issuer } : {}),
        clockTolerance: 5,
      };
      if (alg === 'HS256') {
        if (!this.secret) throw new AppError('invalid_token', 'HS256 tokens are not accepted', 401);
        ({ payload } = await jwtVerify<SupabaseClaims>(token, this.secret, { ...options, algorithms: ['HS256'] }));
      } else {
        if (!this.jwks) throw new AppError('invalid_token', 'Asymmetric tokens require SUPABASE_URL', 401);
        ({ payload } = await jwtVerify<SupabaseClaims>(token, this.jwks, {
          ...options,
          algorithms: ['RS256', 'ES256', 'EdDSA'],
        }));
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof errors.JWTExpired) throw AppError.unauthorized('token_expired', 'Access token expired');
      throw AppError.unauthorized('invalid_token', 'Invalid access token');
    }

    if (payload.role !== 'authenticated' || payload.is_anonymous) {
      throw AppError.unauthorized('invalid_token', 'Token is not for an authenticated user');
    }
    if (!payload.sub || !UUID.test(payload.sub) || !payload.email) {
      throw AppError.unauthorized('invalid_token', 'Token is missing required claims');
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.user_metadata?.email_verified === true,
      sessionId: payload.session_id ?? null,
    };
  }
}
