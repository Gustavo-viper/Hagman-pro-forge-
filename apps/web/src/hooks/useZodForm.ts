import { useCallback, useState, type FormEvent } from 'react';
import type { ZodType, core } from 'zod';

/** Maps a Zod issue to a key under `validation.*` in the locale files. */
export function issueKey(issue: core.$ZodIssue): string {
  const known = new Set([
    'invalid_email', 'password_too_short', 'password_too_long', 'password_weak', 'password_mismatch',
    'invalid_username', 'invalid_country', 'invalid_timezone', 'invalid_characters',
  ]);
  if (known.has(issue.message)) return issue.message;
  if (issue.code === 'invalid_format' && 'format' in issue && issue.format === 'email') return 'invalid_email';
  if (issue.code === 'invalid_format' && 'format' in issue && issue.format === 'date') return 'invalid_date';
  if (issue.code === 'invalid_value') return 'must_accept';
  return 'required';
}

/**
 * Minimal form state bound to a shared @fandom/schemas schema, so the browser validates
 * with exactly the same rules as the API (which validates again — never trust the client).
 */
export function useZodForm<T extends Record<string, unknown>>(schema: ZodType<unknown>, initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T & string, string>>>({});

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const handleSubmit = (onValid: (data: T) => void | Promise<void>) => (event: FormEvent) => {
    event.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '');
        next[key] ??= issueKey(issue);
      }
      setErrors(next as Partial<Record<keyof T & string, string>>);
      return;
    }
    void onValid(result.data as T);
  };

  return { values, errors, set, setErrors, handleSubmit };
}
