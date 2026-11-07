import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../common/app-error.js';
import { IS_PUBLIC, OPTIONAL_AUTH } from '../common/decorators.js';
import type { AuthenticatedUser } from './auth.types.js';
import { TokenVerifierService } from './token-verifier.service.js';
import { UsersService } from './users.service.js';

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifierService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (isPublic) {
      // Optional auth: identify the caller when possible, never reject the request.
      const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, [context.getHandler(), context.getClass()]);
      const h = req.headers.authorization;
      if (optional && h?.startsWith('Bearer ')) {
        try {
          const u = await this.users.resolve(await this.verifier.verify(h.slice(7).trim()));
          if (u && u.status === 'active') req.user = u;
        } catch {
          /* anonymous */
        }
      }
      return true;
    }

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();
    const token = header.slice(7).trim();
    if (!token || token.length > 8192) throw AppError.unauthorized('invalid_token', 'Invalid access token');

    const claims = await this.verifier.verify(token);
    const user = await this.users.resolve(claims);
    if (!user) throw AppError.unauthorized('session_revoked', 'Session is no longer valid');
    if (user.status === 'deleted') throw AppError.unauthorized('account_deleted', 'Account deleted');
    if (user.status !== 'active') throw AppError.forbidden('account_suspended', 'Account suspended');
    req.user = user;
    return true;
  }
}
