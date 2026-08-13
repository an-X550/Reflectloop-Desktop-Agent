import crypto from 'node:crypto';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import { CreateJournalInputSchema, type CreateJournalInput, UpdateJournalInputSchema, type UpdateJournalInput } from '../../shared/schemas/ipc';
import { appError } from '../../shared/errors/app-error';

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rejectFuture(date: string, now: Date) {
  if (date > localDate(now)) throw appError({ code: 'INVALID_INPUT', message: '日志日期不能晚于今天。' });
}

export class CreateJournal {
  constructor(private readonly journals: MarkdownJournalRepository, private readonly now = () => new Date()) {}
  async execute(raw: CreateJournalInput) {
    const input = CreateJournalInputSchema.parse(raw);
    const now = this.now();
    rejectFuture(input.date, now);
    const timestamp = now.toISOString();
    return this.journals.create({
      schemaVersion: 1,
      id: `journal_${crypto.randomUUID().replaceAll('-', '')}`,
      date: input.date,
      body: input.body,
      projectIds: input.projectIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

export class UpdateJournal {
  constructor(private readonly journals: MarkdownJournalRepository, private readonly now = () => new Date()) {}
  async execute(raw: UpdateJournalInput) {
    const input = UpdateJournalInputSchema.parse(raw);
    const now = this.now();
    rejectFuture(input.date, now);
    const existing = await this.journals.get(input.id);
    return this.journals.update({
      ...existing,
      date: input.date,
      body: input.body,
      projectIds: input.projectIds,
      updatedAt: now.toISOString(),
    }, input.expectedUpdatedAt);
  }
}
