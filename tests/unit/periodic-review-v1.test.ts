import { describe, expect, it } from 'vitest';
import {
  PERIODIC_REVIEW_PROMPT_VERSION,
  applyPeriodicQualityGates,
  parsePeriodicReviewOutput,
  periodicSystemPrompt,
  renderPeriodicReview,
  type PeriodicReviewOutput,
} from '../../src/main-process/prompts/periodic-review-v1';

// 金样本：与 .claude/shared/contracts/review-synthesis.md 的稳定结构同构
const goldOutput: PeriodicReviewOutput = {
  chatSummary: '本周完成桌面端契约对齐主线，状态平稳，无重大矛盾。',
  goalReview: '本周期目标是完成周期复盘与 Skill 同构；材料显示目标推进顺利。',
  resultEvaluation: '主线交付完成；作息稳定方向有推进行动证据。',
  causesPositive: '上午关消息有效。Why1 注意力不被打断；Why2 深度工作块变长；Why3 计划先行。',
  causesNegative: '晚间加班效果递减。限制：样本仅一周，存在反例（周三晚间仍完成交付）。',
  ifRedone: '会把测试前置，避免收尾期挤压。',
  nextPlan: { goal: '完成日反馈 260 字上限补齐', means: '提示词补一句并递增版本', check: '下周复盘时核对全量测试结果' },
  directionAnchors: [{ name: '作息稳定', status: '有推进', note: '三篇日志记录 23:30 前入睡' }],
  qualitySelfCheck: '质量门已通过；无影响本次判断的已知缺口。',
};

describe('periodic-review-v3', () => {
  it('exposes the bumped prompt version', () => {
    expect(PERIODIC_REVIEW_PROMPT_VERSION).toBe('periodic-review-v3');
  });

  it('keeps grade-specific rules in the system prompt', () => {
    expect(periodicSystemPrompt('weekly', 'A')).toContain('A 级证据');
    expect(periodicSystemPrompt('weekly', 'B')).toContain('B 级证据');
    expect(periodicSystemPrompt('monthly', 'C')).toContain('C 级证据');
  });

  it('keeps downstream-first material roles and the 800-char cap', () => {
    const prompt = periodicSystemPrompt('weekly', 'A');
    expect(prompt).toContain('下游沉淀优先');
    expect(prompt).toContain('materials.primary');
    expect(prompt).toContain('materials.journalIndex');
    expect(prompt).toContain('800 个中文字符');
  });

  it('carries the six questions, hard quality gates and five anchor states in the prompt', () => {
    const prompt = periodicSystemPrompt('weekly', 'A');
    expect(prompt).toContain('回顾目标');
    expect(prompt).toContain('评估结果');
    expect(prompt).toContain('分析原因');
    expect(prompt).toContain('重来演练');
    expect(prompt).toContain('证据不足');
    expect(prompt).toContain('反例');
    expect(prompt).toContain('有推进');
    expect(prompt).toContain('缺席-未执行');
    expect(prompt).toContain('缺席-未记录');
    expect(prompt).toContain('目标变化');
    expect(prompt).toContain('3Why');
    expect(prompt).toContain('目标 + 手段 + 检查方式');
  });

  it('parses the gold sample', () => {
    const result = parsePeriodicReviewOutput(JSON.stringify(goldOutput));
    expect(result.goalReview).toBe(goldOutput.goalReview);
    expect(result.nextPlan.check).toBe('下周复盘时核对全量测试结果');
  });

  it('parses a fenced code-block JSON output', () => {
    const fenced = '```json\n' + JSON.stringify(goldOutput) + '\n```';
    expect(parsePeriodicReviewOutput(fenced).chatSummary).toBe(goldOutput.chatSummary);
  });

  it('rejects output missing the goal-review section', () => {
    const rest: Record<string, unknown> = { ...goldOutput };
    delete rest.goalReview;
    expect(() => parsePeriodicReviewOutput(JSON.stringify(rest))).toThrow();
  });

  it('rejects a direction-anchor status outside the five contract states', () => {
    const invalid = { ...goldOutput, directionAnchors: [{ name: '考公', status: '失败', note: '无行动证据' }] };
    expect(() => parsePeriodicReviewOutput(JSON.stringify(invalid)) as never).toThrow();
  });

  it('renders the stable weekly structure with six question headings', () => {
    const rendered = renderPeriodicReview(goldOutput, 'weekly', '2026-08-10', '2026-08-16');
    expect(rendered).toContain('# 周报（2026-08-10 ~ 2026-08-16）');
    expect(rendered).toContain('## 聊天摘要');
    expect(rendered).toContain('## 一、回顾目标');
    expect(rendered).toContain('## 二、评估结果');
    expect(rendered).toContain('## 三、分析原因（正向）');
    expect(rendered).toContain('## 四、分析原因（负向）');
    expect(rendered).toContain('## 五、重来演练');
    expect(rendered).toContain('## 六、下周规划');
    expect(rendered).toContain('## 方向锚点缺席检查');
    expect(rendered).toContain('## 质量自检');
    expect(rendered).toContain('- 作息稳定：有推进——三篇日志记录 23:30 前入睡');
    expect(rendered).toContain('目标：完成日反馈 260 字上限补齐');
    expect(rendered).toContain('检查方式：下周复盘时核对全量测试结果');
  });

  it('renders type-specific sixth headings for monthly and project', () => {
    expect(renderPeriodicReview(goldOutput, 'monthly', '2026-07-01', '2026-07-31')).toContain('## 六、下月规划');
    expect(renderPeriodicReview(goldOutput, 'project', '2026-07-01', '2026-07-31')).toContain('## 六、后续规划');
  });

  it('renders an explicit disclosure when no direction anchors were identified', () => {
    const rendered = renderPeriodicReview({ ...goldOutput, directionAnchors: [] }, 'weekly', '2026-08-10', '2026-08-16');
    expect(rendered).toContain('未识别出方向锚点');
  });

  it('keeps A-grade output without extra downgrade notes', () => {
    const gated = applyPeriodicQualityGates(goldOutput, 'A');
    expect(gated.qualitySelfCheck).toBe(goldOutput.qualitySelfCheck);
  });

  it('injects a downgrade disclosure into the quality self-check for B and C grades', () => {
    expect(applyPeriodicQualityGates(goldOutput, 'B').qualitySelfCheck).toContain('B');
    expect(applyPeriodicQualityGates(goldOutput, 'B').qualitySelfCheck).toContain('降级');
    expect(applyPeriodicQualityGates(goldOutput, 'C').qualitySelfCheck).toContain('C');
  });

  it('discloses missing direction anchors in the quality self-check', () => {
    const gated = applyPeriodicQualityGates({ ...goldOutput, directionAnchors: [] }, 'A');
    expect(gated.qualitySelfCheck).toContain('方向锚点不足');
  });
});
