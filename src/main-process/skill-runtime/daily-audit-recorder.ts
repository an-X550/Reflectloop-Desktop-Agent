import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { resolveInsideRoot } from '../infrastructure/markdown/path-policy';
import type { DailyEvidenceGrade } from './daily-evidence';

export interface DailyAuditEvent {
  date: string;
  sourceIds: string[];
  grade: DailyEvidenceGrade;
  outcome: 'review' | 'clarification';
  priorActionStatus?: 'done' | 'not_done' | 'insufficient';
}

export class DailyAuditRecorder {
  constructor(private readonly dataRoot: string, private readonly now = () => new Date().toISOString()) {}

  async record(event: DailyAuditEvent): Promise<void> {
    const target = await resolveInsideRoot(this.dataRoot, 'runtime', 'daily-feedback-audit.jsonl');
    await mkdir(path.dirname(target), { recursive: true });
    await appendFile(target, `${JSON.stringify({ at: this.now(), ...event })}\n`, 'utf8');
  }
}
