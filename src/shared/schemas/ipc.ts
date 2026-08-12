import { z } from 'zod';

const StableJournalId = z.string().regex(/^journal_[a-z0-9]+$/);
const StableProjectId = z.string().regex(/^project_[a-z0-9]+$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SaveJournalInputSchema = z.object({
  id: StableJournalId.optional(),
  date: IsoDate,
  body: z.string().trim().min(1).max(100_000),
  projectIds: z.array(StableProjectId).max(20).default([]),
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

export type SaveJournalInput = z.infer<typeof SaveJournalInputSchema>;
export type JournalQuery = z.infer<typeof JournalQuerySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
