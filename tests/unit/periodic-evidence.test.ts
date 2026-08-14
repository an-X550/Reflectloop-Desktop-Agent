import { describe, expect, it } from 'vitest';
import { buildPeriodicEvidence } from '../../src/main-process/skill-runtime/periodic-evidence';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const journal = (date: string, body = '完成了任务，感到轻松。'): Journal => ({
  schemaVersion: 1, id: `journal_${date}`, date, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`, projectIds: [], body,
});

const dailyReview = (date: string): Review => ({
  schemaVersion: 2, id: `review_${date}`, type: 'daily', periodStart: date, periodEnd: date, sourceIds: [`journal_${date}`], sourceVersions: [], projectId: null, provider: 'openai-compatible', model: 'fake', promptVersion: 'daily-review-v2', createdAt: `${date}T10:00:00.000Z`, body: '反馈',
});

const weeklyReview = (start: string): Review => ({
  schemaVersion: 1, id: `review_weekly_${start}`, type: 'weekly', periodStart: start, periodEnd: start, sourceIds: [], projectId: null, provider: 'openai-compatible', model: 'fake', promptVersion: 'weekly-review-v1', createdAt: `${start}T10:00:00.000Z`, body: '周复盘',
});

describe('buildPeriodicEvidence', () => {
  it('grades D when there are no materials at all', () => {
    const evidence = buildPeriodicEvidence('weekly', [], []);
    expect(evidence.grade).toBe('D');
    expect(evidence.gaps.length).toBeGreaterThan(0);
  });

  it('grades C when there are journals but no downstream reviews', () => {
    const journals = [journal('2026-08-10'), journal('2026-08-11')];
    const evidence = buildPeriodicEvidence('weekly', journals, []);
    expect(evidence.grade).toBe('C');
  });

  it('grades B when there are some daily reviews but not enough for a full week', () => {
    const journals = [journal('2026-08-10'), journal('2026-08-11')];
    const reviews = [dailyReview('2026-08-10')];
    const evidence = buildPeriodicEvidence('weekly', journals, reviews);
    expect(evidence.grade).toBe('B');
  });

  it('grades A when there are enough journals and daily reviews for a week', () => {
    const journals = [journal('2026-08-10'), journal('2026-08-11'), journal('2026-08-12')];
    const reviews = [dailyReview('2026-08-10'), dailyReview('2026-08-11'), dailyReview('2026-08-12')];
    const evidence = buildPeriodicEvidence('weekly', journals, reviews);
    expect(evidence.grade).toBe('A');
  });

  it('grades A for monthly when there are enough weekly reviews', () => {
    const reviews = [weeklyReview('2026-07-28'), weeklyReview('2026-08-04'), weeklyReview('2026-08-11')];
    const evidence = buildPeriodicEvidence('monthly', [], reviews);
    expect(evidence.grade).toBe('A');
  });

  it('grades B for monthly when there are fewer weekly reviews', () => {
    const reviews = [weeklyReview('2026-08-04')];
    const evidence = buildPeriodicEvidence('monthly', [], reviews);
    expect(evidence.grade).toBe('B');
  });

  it('grades D for project when there are no journals for the project', () => {
    const evidence = buildPeriodicEvidence('project', [], []);
    expect(evidence.grade).toBe('D');
  });

  it('grades A for project when there are enough journals', () => {
    const journals = [journal('2026-08-10', '完成了功能 A'), journal('2026-08-11', '修复了 bug B'), journal('2026-08-12', '完成了测试 C')];
    const evidence = buildPeriodicEvidence('project', journals, []);
    expect(evidence.grade).toBe('A');
  });
});
