import { z } from 'zod';

/** { [questionId]: optionKey } — every question of the quiz must be answered. */
export const quizAttemptSchema = z.object({
  answers: z.record(z.uuid(), z.string().min(1).max(10)).refine((a) => Object.keys(a).length <= 50, 'too_many_answers'),
});
export type QuizAttemptInput = z.infer<typeof quizAttemptSchema>;

export const setIdentitySchema = z.object({ key: z.string().regex(/^[a-z0-9_]{1,50}$/, 'invalid_identity') });
export type SetIdentityInput = z.infer<typeof setIdentitySchema>;

export const rankingQuerySchema = z.object({ period: z.enum(['all', 'month', 'week']).default('all') });
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
