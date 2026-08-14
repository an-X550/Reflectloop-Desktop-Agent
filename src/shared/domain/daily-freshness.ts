import type { Review } from '../schemas/domain';

export type SourceVersion = { id: string; updatedAt: string };

/** 从日志列表提取按 id 排序的来源版本快照（S6：双端原重复实现归一到 shared）。 */
export function toSourceVersions(journals: Pick<SourceVersion, 'id' | 'updatedAt'>[]): SourceVersion[] {
  return journals.map(({ id, updatedAt }) => ({ id, updatedAt })).sort((a, b) => a.id.localeCompare(b.id));
}

/** 比较两份来源版本快照是否一致（忽略顺序），不修改入参。 */
export function sourceVersionsMatch(a: SourceVersion[], b: SourceVersion[]): boolean {
  const normalize = (items: SourceVersion[]) => JSON.stringify(items.slice().sort((left, right) => left.id.localeCompare(right.id)));
  return normalize(a) === normalize(b);
}

/** 日反馈新鲜度：复盘存在、为 schemaVersion 2 的当日 daily、且来源版本未变化。renderer 建议下一步与 main 生成去重共用。 */
export function isDailyReviewFresh(review: Review | undefined, date: string, sourceVersions: SourceVersion[]): review is Extract<Review, { schemaVersion: 2 }> {
  return !!review
    && review.schemaVersion === 2
    && review.type === 'daily'
    && review.periodStart === date
    && review.periodEnd === date
    && sourceVersionsMatch(review.sourceVersions, sourceVersions);
}
