import type { InsightReviewType } from '../../../shared/schemas/domain';
import { ReviewTypeCard } from './review-type-card';

export function InsightTools({ onSelect }: { onSelect(type: InsightReviewType): void }) {
  return <div className="review-cards insight-cards">
    <ReviewTypeCard badge="质" title="日志质量检查" description="用至少三篇日志检查事实、感受、思考与行动是否足够清楚。" action="检查日志质量" onSelect={() => onSelect('coach')}/>
    <ReviewTypeCard badge="年" title="年度回顾" description="用至少六份月度复盘提炼主线、反例和下一年度方向。" action="准备年度回顾" onSelect={() => onSelect('yearly')}/>
    <ReviewTypeCard badge="向" title="方向校准" description="基于近期材料，把困惑变成一个低成本的七天实验。" action="校准一个问题" onSelect={() => onSelect('life-design')}/>
  </div>;
}
