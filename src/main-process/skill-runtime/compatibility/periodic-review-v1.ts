export const PERIODIC_REVIEW_COMPATIBILITY = Object.freeze({
  id: 'desktop-periodic-review-v2',
  sourceRuleVersion: '2026-07-08',
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
    'six-question review headings with goal review',
    'chat summary and quality self-check sections',
    'hard quality gates with code-enforced downgrade disclosure',
    'direction-anchor absence check with five states',
    'weekly depth (3Why and three-element plan)',
    'clarification on D-grade',
    'material preview confirmation',
    'validated write',
  ] as const,
  deferred: [
    'distribution',
    'reminders',
    'user-response-section',
    'monthly depth (main-theme merge and life-design escalation reminder)',
  ] as const,
});
