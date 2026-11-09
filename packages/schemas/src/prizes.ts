import { z } from 'zod';

const localized = (max: number) => z.object({ 'pt-BR': z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) });
const iso = z.iso.datetime({ offset: true });
const httpsUrl = z.url().max(500).refine((v) => v.startsWith('https://'), 'https_required');

// ---------------------------------------------------------------- draws (admin)

export const drawCreateSchema = z.object({
  title: localized(120),
  description: localized(1000),
  prize: localized(200),
  prizeCount: z.coerce.number().int().min(1).max(100).default(1),
  requiredPlan: z.enum(['plus', 'ultra', 'vip']).default('vip'),
  entriesCloseAt: iso,
  /** Certificado de Autorização (SPA/MF). Required to open the draw. */
  certificateNumber: z.string().trim().min(3).max(100).nullable().default(null),
  regulationUrl: httpsUrl.nullable().default(null),
});
export type DrawCreateInput = z.infer<typeof drawCreateSchema>;

export const drawUpdateSchema = z
  .object({
    title: localized(120),
    description: localized(1000),
    prize: localized(200),
    prizeCount: z.coerce.number().int().min(1).max(100),
    entriesCloseAt: iso,
    certificateNumber: z.string().trim().min(3).max(100).nullable(),
    regulationUrl: httpsUrl.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update');
export type DrawUpdateInput = z.infer<typeof drawUpdateSchema>;

/** Value published by an external source at draw time (e.g. Loteria Federal 1st prize). */
export const drawRunSchema = z.object({ externalValue: z.string().trim().min(1).max(100) });
export type DrawRunInput = z.infer<typeof drawRunSchema>;

export const prizeCodeSchema = z.object({ code: z.string().trim().min(4).max(200) });
export type PrizeCodeInput = z.infer<typeof prizeCodeSchema>;

// ---------------------------------------------------------------- contests

export const contestCreateSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
    title: localized(120),
    description: localized(1000),
    rules: localized(5000),
    prize: localized(200),
    universeSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).nullable().default(null),
    submissionsOpenAt: iso,
    submissionsCloseAt: iso,
    votingCloseAt: iso,
  })
  .refine((v) => Date.parse(v.submissionsCloseAt) > Date.parse(v.submissionsOpenAt), { path: ['submissionsCloseAt'], message: 'invalid_window' })
  .refine((v) => Date.parse(v.votingCloseAt) > Date.parse(v.submissionsCloseAt), { path: ['votingCloseAt'], message: 'invalid_window' });
export type ContestCreateInput = z.infer<typeof contestCreateSchema>;

export const contestUpdateSchema = z
  .object({
    title: localized(120),
    description: localized(1000),
    rules: localized(5000),
    prize: localized(200),
    submissionsOpenAt: iso,
    submissionsCloseAt: iso,
    votingCloseAt: iso,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update');
export type ContestUpdateInput = z.infer<typeof contestUpdateSchema>;

/** Text fields sent with the image upload (multipart). */
export const contestEntryFieldsSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().default(''),
  /** The entrant declares the artwork is their own (rules requirement). */
  ownWork: z.enum(['true']),
});
export type ContestEntryFields = z.infer<typeof contestEntryFieldsSchema>;

export const contestVoteSchema = z.object({ entryId: z.uuid() });
export const entryReviewSchema = z.object({ action: z.enum(['approve', 'reject']) });
export const contestWinnerSchema = z.object({ entryId: z.uuid() });
