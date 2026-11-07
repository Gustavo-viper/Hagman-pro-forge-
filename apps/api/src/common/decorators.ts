import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PlanCode, StaffRole } from '@fandom/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';

export const IS_PUBLIC = 'fandom:isPublic';
export const OPTIONAL_AUTH = 'fandom:optionalAuth';
export const REQUIRED_ROLES = 'fandom:roles';
export const REQUIRED_PLAN = 'fandom:plan';

/** Route does not require authentication. Everything else does (secure by default). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Public route that still identifies the caller when a valid token is sent. */
export const OptionalAuth = () => (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
  SetMetadata(IS_PUBLIC, true)(target, key!, descriptor!);
  SetMetadata(OPTIONAL_AUTH, true)(target, key!, descriptor!);
};

export const OptionalUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
  return ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user ?? null;
});

/** Requires at least one of the staff roles (checked against the database on every request). */
export const Roles = (...roles: StaffRole[]) => SetMetadata(REQUIRED_ROLES, roles);

/** Requires an entitled subscription of at least this plan (verified server-side). */
export const RequiresPlan = (plan: Exclude<PlanCode, 'free'>) => SetMetadata(REQUIRED_PLAN, plan);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  if (!req.user) throw new Error('CurrentUser used on a public route');
  return req.user;
});
