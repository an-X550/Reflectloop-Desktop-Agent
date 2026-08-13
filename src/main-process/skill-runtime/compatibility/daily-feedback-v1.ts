export const DAILY_FEEDBACK_COMPATIBILITY = Object.freeze({
  id: 'desktop-daily-feedback-v1',
  sourceRuleVersion: '2026-07-31',
  runtimeReadsClaudeDirectory: false,
  materialCategories: [
    'target-journals',
    'previous-daily-review',
    'verified-patterns',
  ] as const,
  supports: [
    'A-D evidence grading',
    'prior-action closure',
    'single action',
    'validated write',
  ] as const,
  deferred: [
    'verified-pattern persistence',
    'distribution',
    'reminders',
  ] as const,
});
