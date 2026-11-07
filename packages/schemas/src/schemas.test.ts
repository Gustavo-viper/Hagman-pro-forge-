import { describe, expect, it } from 'vitest';
import { onboardingSchema, signUpSchema, usernameSchema, universeThemeSchema } from './index.js';

describe('usernameSchema', () => {
  it.each(['harry_fan', 'dean.w', 'abc', 'a1b2c3'])('accepts %s', (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(true);
  });
  it.each(['ab', '.start', 'end.', 'two..dots', 'with space', 'x'.repeat(25), '<script>'])(
    'rejects %s',
    (u) => {
      expect(usernameSchema.safeParse(u).success).toBe(false);
    },
  );
  it('normalizes case', () => {
    expect(usernameSchema.parse('HarryFan')).toBe('harryfan');
  });
});

describe('signUpSchema', () => {
  it('requires matching strong passwords', () => {
    expect(
      signUpSchema.safeParse({ email: 'a@b.com', password: 'abc12345', confirmPassword: 'abc12345' })
        .success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({ email: 'a@b.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' })
        .success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ email: 'a@b.com', password: 'abc12345', confirmPassword: 'abc12346' })
        .success,
    ).toBe(false);
  });
});

describe('onboardingSchema', () => {
  const valid = {
    username: 'luna_l',
    displayName: 'Luna',
    birthdate: '2000-05-01',
    country: 'br',
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    acceptTerms: true,
    acceptPrivacy: true,
  };
  it('accepts valid data and normalizes country', () => {
    const r = onboardingSchema.parse(valid);
    expect(r.country).toBe('BR');
    expect(r.marketingEmail).toBe(false);
  });
  it('requires legal acceptance', () => {
    expect(onboardingSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });
  it('rejects invalid timezone', () => {
    expect(onboardingSchema.safeParse({ ...valid, timezone: 'Mars/Olympus' }).success).toBe(false);
  });
  it('rejects markup in display name', () => {
    expect(onboardingSchema.safeParse({ ...valid, displayName: '<b>x</b>' }).success).toBe(false);
  });
});

describe('universeThemeSchema', () => {
  it('validates hex colors', () => {
    expect(
      universeThemeSchema.safeParse({
        primary: '#000000',
        secondary: '#ffffff',
        accent: '#123abc',
        background: '#0a0a0a',
        glow: '#ff00ff',
      }).success,
    ).toBe(true);
    expect(universeThemeSchema.safeParse({ primary: 'red' }).success).toBe(false);
  });
});
