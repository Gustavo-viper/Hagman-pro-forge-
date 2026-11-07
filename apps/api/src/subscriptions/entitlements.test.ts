import { describe, expect, it } from 'vitest';
import { entitledPlan } from './entitlements.service.js';

const now = new Date('2026-11-07T12:00:00Z');
const future = new Date('2026-12-07T12:00:00Z');
const past = new Date('2026-10-07T12:00:00Z');
const base = { plan_code: 'plus' as const, billing_interval: 'month' as const, cancel_at_period_end: false, grace_until: null, current_period_end: future };

describe('entitledPlan', () => {
  it('free without subscription', () => expect(entitledPlan(null, now)).toBe('free'));
  it('active within period', () => expect(entitledPlan({ ...base, status: 'active' }, now)).toBe('plus'));
  it('active but period ended', () => expect(entitledPlan({ ...base, status: 'active', current_period_end: past }, now)).toBe('free'));
  it('pending never grants', () => expect(entitledPlan({ ...base, status: 'pending' }, now)).toBe('free'));
  it('past_due within grace', () => expect(entitledPlan({ ...base, status: 'past_due', grace_until: future }, now)).toBe('plus'));
  it('past_due after grace', () => expect(entitledPlan({ ...base, status: 'past_due', grace_until: past }, now)).toBe('free'));
  it('cancelled keeps paid period', () => expect(entitledPlan({ ...base, status: 'cancelled' }, now)).toBe('plus'));
  it('cancelled after period', () => expect(entitledPlan({ ...base, status: 'cancelled', current_period_end: past }, now)).toBe('free'));
  it('expired never grants', () => expect(entitledPlan({ ...base, status: 'expired' }, now)).toBe('free'));
});
