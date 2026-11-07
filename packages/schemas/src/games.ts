import { z } from 'zod';

const answerKey = z.string().min(1).max(10);

/** Daily challenge: { [questionId]: optionKey } for every question of the day. */
export const dailySubmitSchema = z.object({
  answers: z.record(z.uuid(), answerKey).refine((a) => Object.keys(a).length <= 20, 'too_many_answers'),
});
export type DailySubmitInput = z.infer<typeof dailySubmitSchema>;

export const speedAnswerSchema = z.object({ questionId: z.uuid(), key: answerKey });
export type SpeedAnswerInput = z.infer<typeof speedAnswerSchema>;

/** One letter A–Z (accents are matched server-side: "A" also reveals "Á", "Ã"...). */
export const hangmanGuessSchema = z.object({ letter: z.string().regex(/^[A-Za-z]$/, 'invalid_letter').transform((v) => v.toUpperCase()) });
export type HangmanGuessInput = z.infer<typeof hangmanGuessSchema>;

export const gameLeaderboardQuerySchema = z.object({ game: z.enum(['daily', 'speed', 'hangman']).default('daily') });
export type GameLeaderboardQuery = z.infer<typeof gameLeaderboardQuerySchema>;
