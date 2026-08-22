import type { Journal, Review, VerifiedPatternSnapshot } from '../../src/shared/schemas/domain';

/** Public, test-only evidence data. It never touches the user's default data directory. */
export const agentEvidenceDemo: {
  journals: Journal[];
  reviews: Review[];
  patterns: VerifiedPatternSnapshot;
} = {
  journals: [
    {
      schemaVersion: 1,
      id: 'journal_fact_20260818',
      date: '2026-08-18',
      createdAt: '2026-08-18T09:00:00.000+08:00',
      updatedAt: '2026-08-18T09:00:00.000+08:00',
      projectIds: [],
      body: '事实记录：2026-08-18 已完成证据卡片验收，日期可以回到日志核对。',
    },
    {
      schemaVersion: 1,
      id: 'journal_pattern_20260819',
      date: '2026-08-19',
      createdAt: '2026-08-19T09:00:00.000+08:00',
      updatedAt: '2026-08-19T09:00:00.000+08:00',
      projectIds: [],
      body: '把大任务拆成两个更小步骤，今天完成了第一步。',
    },
    {
      schemaVersion: 1,
      id: 'journal_pattern_20260821',
      date: '2026-08-21',
      createdAt: '2026-08-21T09:00:00.000+08:00',
      updatedAt: '2026-08-21T09:00:00.000+08:00',
      projectIds: [],
      body: '再次把行动拆小，第二次按小步骤完成。',
    },
    {
      schemaVersion: 1,
      id: 'journal_conflict_20260822',
      date: '2026-08-22',
      createdAt: '2026-08-22T09:00:00.000+08:00',
      updatedAt: '2026-08-22T09:00:00.000+08:00',
      projectIds: [],
      body: '事实记录：接口已经完成并可复核。',
    },
  ],
  reviews: [
    {
      schemaVersion: 1,
      id: 'review_pattern_20260821',
      type: 'weekly',
      periodStart: '2026-08-18',
      periodEnd: '2026-08-21',
      sourceIds: ['journal_pattern_20260819', 'journal_pattern_20260821'],
      projectId: null,
      provider: 'openai-compatible',
      model: 'fixture',
      promptVersion: 'periodic-review-v1',
      createdAt: '2026-08-21T18:00:00.000+08:00',
      body: '复盘观察：把大任务拆成小步骤后更容易完成。',
    },
    {
      schemaVersion: 1,
      id: 'review_conflict_20260822',
      type: 'weekly',
      periodStart: '2026-08-18',
      periodEnd: '2026-08-22',
      sourceIds: ['journal_conflict_20260822'],
      projectId: null,
      provider: 'openai-compatible',
      model: 'fixture',
      promptVersion: 'periodic-review-v1',
      createdAt: '2026-08-22T18:00:00.000+08:00',
      body: '复盘误写：接口尚未完成，后续仍需启动。',
    },
  ],
  patterns: {
    schemaVersion: 1,
    updatedAt: '2026-08-22T18:00:00.000+08:00',
    patterns: [{
      schemaVersion: 1,
      id: 'pattern_split_actions',
      statement: '拆小行动有助于持续执行。',
      evidenceSummary: '来自两个不同日期的脱敏日志和周期复盘。',
      sourceReviewIds: ['review_pattern_20260821'],
      createdAt: '2026-08-22T18:30:00.000+08:00',
    }],
  },
};
