import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DailyAuditRecorder } from '../../src/main-process/skill-runtime/daily-audit-recorder';

describe('DailyAuditRecorder', () => {
  it('appends a local, structured record for a completed daily feedback run', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-audit-'));
    const recorder = new DailyAuditRecorder(root, () => '2026-08-14T01:00:00.000Z');

    await recorder.record({ date: '2026-08-13', sourceIds: ['journal_a1'], grade: 'B', outcome: 'review', priorActionStatus: 'done' });

    const lines = (await readFile(path.join(root, 'runtime', 'daily-feedback-audit.jsonl'), 'utf8')).trim().split('\n');
    expect(JSON.parse(lines[0])).toEqual({ at: '2026-08-14T01:00:00.000Z', date: '2026-08-13', sourceIds: ['journal_a1'], grade: 'B', outcome: 'review', priorActionStatus: 'done' });
  });
});
