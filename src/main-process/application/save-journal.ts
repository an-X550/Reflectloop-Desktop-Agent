import crypto from 'node:crypto';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import { SaveJournalInputSchema, type SaveJournalInput } from '../../shared/schemas/ipc';

export class SaveJournal {
  constructor(private readonly journals: MarkdownJournalRepository) {}
  async execute(raw: SaveJournalInput) {
    const input = SaveJournalInputSchema.parse(raw);
    const existing = input.id ? await this.journals.get(input.id).catch(() => null) : null;
    const now = new Date().toISOString();
    return this.journals.save({
      schemaVersion: 1,
      id: input.id ?? `journal_${crypto.randomUUID().replaceAll('-', '')}`,
      date: input.date,
      body: input.body,
      projectIds: input.projectIds,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }
}
