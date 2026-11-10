/** Invite code kept in the browser between opening /convite/:code and creating the account. */
const KEY = 'fandom.referral';
const TTL_MS = 30 * 24 * 3_600_000;
const PATTERN = /^[A-Z0-9]{6,12}$/;

export function saveReferralCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (!PATTERN.test(c)) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: c, at: Date.now() }));
  } catch {
    /* private mode: the code is simply not remembered */
  }
  return true;
}

export function readReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { code?: string; at?: number };
    if (!v.code || !PATTERN.test(v.code) || !v.at || Date.now() - v.at > TTL_MS) return null;
    return v.code;
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
