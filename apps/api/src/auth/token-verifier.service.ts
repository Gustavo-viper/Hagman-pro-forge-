import { Inject, Injectable } from '@nestjs/common';
import { errors, jwtVerify, SignJWT } from 'jose';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AppError } from '../common/app-error.js';
import type { AccessTokenClaims } from './auth.types.js';

const ISSUER = 'fandom-api';
const AUDIENCE = 'fandom-web';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Issues and verifies the platform's own short-lived access tokens (HS256).
 * Signature, issuer, audience, expiry and claim shape are all checked.
 */
@Injectable()
export class TokenVerifierService {
  private readonly secret: Uint8Array;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.secret = new TextEncoder().encode(env.AUTH_JWT_SECRET);
  }

  get accessTtlSeconds(): number {
    return this.env.AUTH_ACCESS_TOKEN_TTL_SECONDS;
  }

  sign(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ sid: claims.sid })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.env.AUTH_ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
        clockTolerance: 5,
      });
      if (!payload.sub || !UUID.test(payload.sub) || typeof payload.sid !== 'string' || !UUID.test(payload.sid)) {
        throw AppError.unauthorized('invalid_token', 'Token is missing required claims');
      }
      return { sub: payload.sub, sid: payload.sid };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof errors.JWTExpired) throw AppError.unauthorized('token_expired', 'Access token expired');
      throw AppError.unauthorized('invalid_token', 'Invalid access token');
    }
  }
}
