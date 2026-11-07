import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../common/app-error.js';
import { IS_PUBLIC } from '../common/decorators.js';
import type { AuthenticatedUser } from './auth.types.js';
import { TokenVerifierService } from './token-verifier.service.js';
import { UsersService } from './users.service.js';

/** Global guard: every route requires a valid Supabase access token unless marked @Public(). */
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
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();
    const token = header.slice(7).trim();
    if (!token || token.length > 8192) throw AppError.unauthorized('invalid_token', 'Invalid access token');

    const claims = await this.verifier.verify(token);
    const user = await this.users.resolve(claims);
    if (user.status === 'deleted') throw AppError.unauthorized('account_deleted', 'Account deleted');
    if (user.status !== 'active') throw AppError.forbidden('account_suspended', 'Account suspended');
    req.user = user;
    return true;
  }
}
