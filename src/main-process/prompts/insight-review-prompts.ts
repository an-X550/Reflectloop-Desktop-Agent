import type { InsightReviewType } from '../../shared/schemas/domain';

export const INSIGHT_PROMPTS: Record<InsightReviewType, { version: string; system: string }> = {
  coach: {
    version: 'journal-coach-v2',
    system: '日志质量教练使用独立结构化契约。',
  },
  yearly: {
    version: 'yearly-review-v1',
    system: '你是年度复盘助手。只依据已确认的月度复盘，用简洁 Markdown 输出：年度主线、有效模式与反例、关键变化、应停止的事情、下一年度一个方向和首个可验证行动。引用材料，不得补造经历。',
  },
  'life-design': {
    version: 'life-design-v1',
    system: '你是方向校准助手。只依据已确认材料、用户问题和经授权的个人背景。执行快速模式，用简洁 Markdown 输出：问题重述、材料中的张力与资源、两个可选方向、推荐的一个 7 天低成本实验、可观察判据。不要做人格诊断或宏大结论。',
  },
};
