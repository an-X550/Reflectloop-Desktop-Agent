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

const StablePatternId = z.string().regex(/^pattern_[a-z0-9]+$/);
const StableReviewId = z.string().regex(/^review_[a-z0-9]+$/);
export const VerifiedPatternSchema = z.object({
  schemaVersion: z.literal(1),
  id: StablePatternId,
  statement: z.string().trim().min(1).max(500),
  evidenceSummary: z.string().trim().min(1).max(1000),
  sourceReviewIds: z.array(StableReviewId).min(1).max(20),
  createdAt: IsoDateTime,
});
export const VerifiedPatternSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: IsoDateTime,
  patterns: z.array(VerifiedPatternSchema).max(500),
});
export const VerifiedPatternCandidateSchema = z.object({
  statement: z.string().trim().min(1).max(500),
  evidenceSummary: z.string().trim().min(1).max(1000),
  sourceReviewIds: z.array(StableReviewId).min(1).max(20),
}).strict();

export type Journal = z.infer<typeof JournalSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type DailyGenerationResult = { kind: 'review'; review: Review } | { kind: 'clarification'; question: string };
export type PeriodicGenerationResult = { kind: 'review'; review: Review } | { kind: 'clarification'; question: string };
export type InsightReviewType = Extract<Review['type'], 'coach' | 'yearly' | 'life-design'>;
export type Profile = z.infer<typeof ProfileSchema>;
export type VerifiedPattern = z.infer<typeof VerifiedPatternSchema>;
export type VerifiedPatternSnapshot = z.infer<typeof VerifiedPatternSnapshotSchema>;
export type VerifiedPatternCandidate = z.infer<typeof VerifiedPatternCandidateSchema>;

export const TopicIndexEntrySchema = z.object({
  topic: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  coreQuestion: z.string().trim().min(1).max(500),
  aliases: z.array(z.string().trim().min(1).max(80)).max(10),
  updatedAt: IsoDateTime,
});
export const TopicIndexSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(TopicIndexEntrySchema).max(500),
});
export const TopicMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20_000),
  at: IsoDateTime,
});
export const TopicSessionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^topicsession_[a-z0-9]+$/),
  question: z.string().trim().min(1).max(2000),
  referencedTopics: z.array(z.string().trim().min(1).max(80)).max(2),
  messages: z.array(TopicMessageSchema).max(200),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export const WebSearchResultSchema = z.object({
  sourceId: z.string().regex(/^source_[a-z0-9]+$/),
  title: z.string().trim().min(1).max(300),
  url: z.url().max(2048),
  snippet: z.string().max(1000),
  publishedAt: z.string().max(40).nullable(),
  retrievedAt: IsoDateTime,
});
export type TopicIndexEntry = z.infer<typeof TopicIndexEntrySchema>;
export type TopicIndex = z.infer<typeof TopicIndexSchema>;
export type TopicMessage = z.infer<typeof TopicMessageSchema>;
export type TopicSession = z.infer<typeof TopicSessionSchema>;
export type WebSearchResult = z.infer<typeof WebSearchResultSchema>;

export const WebSourceContentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.url().max(2048),
  publishedAt: z.string().max(40).nullable(),
  excerpt: z.string().max(2000),
}).strict();
export type WebSourceContent = z.infer<typeof WebSourceContentSchema>;

export const WorkflowIntentSchema = z.enum(['write-journal', 'daily-review', 'weekly-review', 'monthly-review', 'project-review', 'topic-thinking']);
export type WorkflowIntent = z.infer<typeof WorkflowIntentSchema>;

export const IntentResolutionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('matched'), intent: WorkflowIntentSchema, source: z.enum(['deterministic', 'model']), reason: z.string().max(200) }).strict(),
  z.object({ kind: z.literal('clarify'), question: z.string().trim().min(1).max(500) }).strict(),
]);
export type IntentResolution = z.infer<typeof IntentResolutionSchema>;
