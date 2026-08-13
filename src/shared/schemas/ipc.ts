import { z } from 'zod';

const StableJournalId = z.string().regex(/^journal_[a-z0-9]+$/);
const StableProjectId = z.string().regex(/^project_[a-z0-9]+$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, '无效日期');

export const CreateJournalInputSchema = z.object({
  date: IsoDate,
  body: z.string().trim().min(1).max(100_000),
  projectIds: z.array(StableProjectId).max(20).default([]),
}).strict();

export const UpdateJournalInputSchema = CreateJournalInputSchema.extend({
  id: StableJournalId,
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
}).strict();

export const JournalQuerySchema = z.object({
  start: IsoDate.optional(),
  end: IsoDate.optional(),
  projectId: StableProjectId.optional(),
}).strict();

export const CreateProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
}).strict();

export const IdSchema = z.string().regex(/^(journal|project)_[a-z0-9]+$/);

export const SaveProviderConfigInputSchema = z.object({
  providerId: z.enum(['openai', 'deepseek', 'custom']),
  baseUrl: z.string().trim().min(1).max(2048),
  model: z.string().trim().min(1).max(160),
  apiKey: z.string().trim().min(1).max(4096).optional(),
}).strict();
export const SaveProfileInputSchema = z.object({ body: z.string().trim().min(1).max(100_000), enabledForAi: z.boolean() }).strict();
export type SaveProfileInput = z.infer<typeof SaveProfileInputSchema>;

export const GenerateDailyReviewInputSchema = z.object({
  date: IsoDate,
  regenerate: z.boolean().optional(),
}).strict();
const PeriodicReviewBaseSchema = z.object({
  type: z.enum(['weekly', 'monthly', 'project']), start: IsoDate, end: IsoDate,
  projectId: StableProjectId.optional(),
}).strict();
const validPeriodicRange = (value: { start: string; end: string }) => value.start <= value.end;
export const PeriodicReviewPreviewInputSchema = PeriodicReviewBaseSchema
  .refine(validPeriodicRange, '开始日期不能晚于结束日期');
export const PeriodicReviewGenerateInputSchema = PeriodicReviewBaseSchema.extend({ previewToken: z.string().uuid() })
  .refine(validPeriodicRange, '开始日期不能晚于结束日期');
export type PeriodicReviewPreviewInput = z.infer<typeof PeriodicReviewPreviewInputSchema>;
export type PeriodicReviewGenerateInput = z.infer<typeof PeriodicReviewGenerateInputSchema>;

export type CreateJournalInput = z.infer<typeof CreateJournalInputSchema>;
export type UpdateJournalInput = z.infer<typeof UpdateJournalInputSchema>;
export type JournalQuery = z.infer<typeof JournalQuerySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type SaveProviderConfigInput = z.infer<typeof SaveProviderConfigInputSchema>;
