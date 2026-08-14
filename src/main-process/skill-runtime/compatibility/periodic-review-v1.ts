export const PERIODIC_REVIEW_COMPATIBILITY = Object.freeze({
  id: 'desktop-periodic-review-v1',
  sourceRuleVersion: '2026-07-31',
  runtimeReadsClaudeDirectory: false,
  materialCategories: [
    'target-journals',
    'daily-reviews',
    'weekly-reviews',
    'verified-patterns',
  ] as const,
  supports: [
    'A-D evidence grading',
    'downstream-first materials',
    'six-question review',
    'clarification on D-grade',
    'material preview confirmation',
    'validated write',
  ] as const,
  deferred: [
    'distribution',
    'reminders',
    'user-response-section',
  ] as const,
});
