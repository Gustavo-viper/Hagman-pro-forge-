/** URL-safe slug: lowercase ASCII, digits and single hyphens. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Age in full years at `now` for an ISO date (YYYY-MM-DD). */
export function ageFromBirthdate(birthdate: string, now: Date = new Date()): number {
  const [y, m, d] = birthdate.split('-').map(Number);
  if (!y || !m || !d) throw new RangeError('invalid birthdate');
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}
