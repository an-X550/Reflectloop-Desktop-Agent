import { z } from 'zod';

const StableId = z.string().regex(/^(journal|review|project)_[a-z0-9]+$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateTime = z.iso.datetime({ offset: true });

export const JournalSchema = z.object({
  schemaVersion: z.literal(1),
  id: StableId.refine((id) => id.startsWith('journal_')),
  date: IsoDate,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  projectIds: z.array(StableId.refine((id) => id.startsWith('project_'))),
  body: z.string().min(1),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: StableId.refine((id) => id.startsWith('project_')),
  name: z.string().trim().min(1).max(80),
  status: z.enum(['active', 'archived']),
  createdAt: IsoDateTime,
  archivedAt: IsoDateTime.nullable(),
});

const ReviewBaseSchema = z.object({
  id: StableId.refine((id) => id.startsWith('review_')),
  type: z.enum(['daily', 'weekly', 'monthly', 'project', 'coach', 'yearly', 'life-design']),
  periodStart: IsoDate,
  periodEnd: IsoDate,
  sourceIds: z.array(StableId).min(1),
  projectId: StableId.nullable(),
  provider: z.literal('openai-compatible'),
  model: z.string().min(1),
  promptVersion: z.string().regex(/^[a-z-]+-v\d+$/),
  createdAt: IsoDateTime,
  body: z.string().min(1),
});
export const ReviewSchema = z.union([
  ReviewBaseSchema.extend({ schemaVersion: z.literal(1) }),
  ReviewBaseSchema.extend({
    schemaVersion: z.literal(2),
    sourceVersions: z.array(z.object({ id: StableId, updatedAt: IsoDateTime })).min(1),
  }),
]);
export const ProfileSchema = z.object({ schemaVersion: z.literal(1), body: z.string().max(100_000), enabledForAi: z.boolean(), createdAt: IsoDateTime, updatedAt: IsoDateTime });

export type Journal = z.infer<typeof JournalSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type DailyGenerationResult = { kind: 'review'; review: Review } | { kind: 'clarification'; question: string };
export type InsightReviewType = Extract<Review['type'], 'coach' | 'yearly' | 'life-design'>;
export type Profile = z.infer<typeof ProfileSchema>;
