export const PERIODIC_PROMPTS = {
  weekly: { version: 'weekly-review-v1', label: '周报' },
  monthly: { version: 'monthly-review-v1', label: '月报' },
  project: { version: 'project-review-v1', label: '项目复盘' },
} as const;

export function periodicSystemPrompt(type: keyof typeof PERIODIC_PROMPTS) {
  return `你在生成${PERIODIC_PROMPTS[type].label}。只根据材料回答：结果是什么；什么行为有效；什么无效；有哪些证据或矛盾；重来会如何选择；下一项可验证行动是什么。返回 Markdown，并在结论后标注来源 ID。`;
}
