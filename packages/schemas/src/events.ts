import { z } from 'zod';

const localized = (max: number) =>
  z.object({ 'pt-BR': z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) });

const httpsUrl = z.url().max(500).refine((v) => v.startsWith('https://'), 'https_required');

/** Admin: create an event in a universe. Dates are ISO strings with timezone. */
export const createEventSchema = z
  .object({
    universeSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    title: localized(120),
    description: localized(1000),
    kind: z.enum(['community', 'tournament', 'watch_party', 'challenge']),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    capacity: z.coerce.number().int().min(1).max(100000).nullable().default(null),
    premiumPlan: z.enum(['plus', 'ultra']).nullable().default(null),
    externalUrl: httpsUrl.nullable().default(null),
    quizId: z.uuid().nullable().default(null),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), { path: ['endsAt'], message: 'ends_before_start' });
export type CreateEventInput = z.infer<typeof createEventSchema>;

/** Admin: partial update. */
export const updateEventSchema = z
  .object({
    title: localized(120),
    description: localized(1000),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    capacity: z.coerce.number().int().min(1).max(100000).nullable(),
    premiumPlan: z.enum(['plus', 'ultra']).nullable(),
    externalUrl: httpsUrl.nullable(),
    quizId: z.uuid().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update');
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventMessageSchema = z.object({
  body: z.string().trim().min(1).max(500).refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), 'invalid_characters'),
});
export type EventMessageInput = z.infer<typeof eventMessageSchema>;
