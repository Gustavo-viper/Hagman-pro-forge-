import { z } from 'zod';

const sectionKey = z.string().regex(/^[a-z_]{2,40}$/, 'invalid_section');
export const sectionKeySchema = sectionKey;

/** Plain text only: control characters are stripped by trimming and rejected below. */
const text = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), 'invalid_characters');

export const createTopicSchema = z.object({ title: text(3, 140), body: text(1, 5000) });
export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const createReplySchema = z.object({ body: text(1, 3000) });
export type CreateReplyInput = z.infer<typeof createReplySchema>;

export const reportSchema = z.object({
  targetType: z.enum(['topic', 'reply']),
  targetId: z.uuid(),
  reason: z.enum(['spam', 'harassment', 'hate', 'sexual', 'violence', 'personal_data', 'spoiler', 'other']),
  details: z.string().trim().max(500).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const forumListSchema = z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export type ForumListInput = z.infer<typeof forumListSchema>;

export const resolveReportSchema = z.object({ action: z.enum(['hide', 'dismiss']), note: z.string().trim().max(500).optional() });
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

/** Personal reading shelf: null removes the book from the shelf. */
export const shelfUpdateSchema = z.object({ status: z.enum(['want', 'reading', 'read']).nullable() });
export type ShelfUpdateInput = z.infer<typeof shelfUpdateSchema>;
