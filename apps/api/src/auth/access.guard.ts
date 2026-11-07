import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_RANK, type PlanCode, type StaffRole } from '@fandom/shared';
import { AppError } from '../common/app-error.js';
import { REQUIRED_PLAN, REQUIRED_ROLES } from '../common/decorators.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import type { AuthenticatedUser } from './auth.types.js';

/**
 * Enforces @Roles() and @RequiresPlan() on the server. Runs after AuthGuard.
 * super_admin implicitly satisfies every role requirement.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(REQUIRED_ROLES, targets);
    const plan = this.reflector.getAllAndOverride<Exclude<PlanCode, 'free'> | undefined>(REQUIRED_PLAN, targets);
    if (!roles?.length && !plan) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw AppError.unauthorized();

    if (roles?.length && !user.roles.includes('super_admin') && !roles.some((r) => user.roles.includes(r))) {
      throw AppError.forbidden('insufficient_role', 'Insufficient permissions');
    }
    if (plan) {
      const snapshot = await this.entitlements.snapshot(user.id);
      if (PLAN_RANK[snapshot.planCode] < PLAN_RANK[plan]) {
        throw new AppError('premium_required', `Requires ${plan} plan`, 403, { requiredPlan: plan });
      }
    }
    return true;
  }
}
