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
  nextPlan: { goal: '完成日反馈 260 字上限补齐', means: '提示词补一句并递增版本', check: '下周复盘时核对全量测试结果', hypothesis: null },
  directionAnchors: [{ name: '作息稳定', status: '有推进', note: '三篇日志记录 23:30 前入睡' }],
  qualitySelfCheck: '质量门已通过；无影响本次判断的已知缺口。',
  mainThemes: [],
  escalationReminder: null,
};

// 月报金样本：主主题归并 + 下月规划四要素 + 升级提醒（桌面语境措辞）
const monthlyGoldOutput: PeriodicReviewOutput = {
  ...goldOutput,
  chatSummary: '本月主线是桌面端同构与求职准备并行，方向冲突显现。',
  nextPlan: { goal: '把求职主线推进到简历定稿', means: '每周两个晚上改简历与投递', check: '月末核对投递记录', hypothesis: '若先归并主主题，下月规划会更聚焦，重复卡点减少。' },
  mainThemes: [
    {
      name: '开发与求职的时间冲突',
      supportingPerspectives: '日志、日反馈、周复盘',
      keyEvidence: '三周周复盘均记录开发挤占投递时间',
      counterExampleOrGap: '反例：最后一周投递了两次；证据不足以断言长期模式',
      significance: '重来演练需保留投递最低节奏；下月规划需给求职留固定时段',
    },
    {
      name: '晚间状态下滑',
      supportingPerspectives: '日反馈',
      keyEvidence: '多日日反馈记录 23 点后效率下降',
      counterExampleOrGap: '证据不足：缺少白天对照',
      significance: '下月把重要任务前移',
    },
  ],
  escalationReminder: '⚠️ 这可能不是普通执行问题：本月材料显示长期方向冲突连续三个月出现。建议在复盘页的“方向校准”做一次人生设计校准。',
};

describe('periodic-review-v4', () => {
  it('exposes the bumped prompt version', () => {
    expect(PERIODIC_REVIEW_PROMPT_VERSION).toBe('periodic-review-v4');
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

  it('carries monthly depth rules only in the monthly prompt', () => {
    const monthly = periodicSystemPrompt('monthly', 'A');
    expect(monthly).toContain('主主题');
    expect(monthly).toContain('2-3');
    expect(monthly).toContain('目标 + 手段 + 检查点 + 假说');
    expect(monthly).toContain('升级提醒');
    expect(monthly).toContain('方向校准');
    expect(monthly).toContain('不强行制造');
    expect(monthly).not.toContain('/life-design');
    const weekly = periodicSystemPrompt('weekly', 'A');
    expect(weekly).not.toContain('主主题');
    expect(weekly).not.toContain('升级提醒');
  });

  it('parses the monthly gold sample with main themes, hypothesis and escalation reminder', () => {
    const result = parsePeriodicReviewOutput(JSON.stringify(monthlyGoldOutput));
    expect(result.mainThemes).toHaveLength(2);
    expect(result.mainThemes[0].counterExampleOrGap).toContain('反例');
    expect(result.nextPlan.hypothesis).toContain('归并');
    expect(result.escalationReminder).toContain('⚠️');
  });

  it('parses weekly output without monthly fields using safe defaults', () => {
    const legacy: Record<string, unknown> = { ...goldOutput };
    delete legacy.mainThemes;
    delete legacy.escalationReminder;
    const parsed = parsePeriodicReviewOutput(JSON.stringify({ ...legacy, nextPlan: { goal: 'g', means: 'm', check: 'c' } }));
    expect(parsed.mainThemes).toEqual([]);
    expect(parsed.escalationReminder).toBeNull();
    expect(parsed.nextPlan.hypothesis).toBeNull();
    expect(goldOutput.mainThemes).toEqual([]);
  });

  it('rejects more than three main themes', () => {
    const tooMany = { ...monthlyGoldOutput, mainThemes: [...monthlyGoldOutput.mainThemes, monthlyGoldOutput.mainThemes[0], monthlyGoldOutput.mainThemes[0]] };
    expect(() => parsePeriodicReviewOutput(JSON.stringify(tooMany)) as never).toThrow();
  });

  it('renders the monthly main-theme section, hypothesis and escalation reminder', () => {
    const rendered = renderPeriodicReview(monthlyGoldOutput, 'monthly', '2026-07-01', '2026-07-31');
    expect(rendered).toContain('## 主主题');
    expect(rendered).toContain('开发与求职的时间冲突');
    expect(rendered).toContain('支持视角：日志、日反馈、周复盘');
    expect(rendered).toContain('关键证据：三周周复盘均记录开发挤占投递时间');
    expect(rendered).toContain('反例或证据不足：反例：最后一周投递了两次；证据不足以断言长期模式');
    expect(rendered).toContain('对重来演练或下月规划的意义：重来演练需保留投递最低节奏；下月规划需给求职留固定时段');
    expect(rendered).toContain('假说：若先归并主主题，下月规划会更聚焦，重复卡点减少。');
    expect(rendered).toContain('⚠️ 这可能不是普通执行问题');
  });

  it('keeps weekly and project rendering free of monthly-only sections', () => {
    expect(renderPeriodicReview(monthlyGoldOutput, 'weekly', '2026-08-10', '2026-08-16')).not.toContain('## 主主题');
    expect(renderPeriodicReview(monthlyGoldOutput, 'project', '2026-07-01', '2026-07-31')).not.toContain('## 主主题');
  });

  it('renders an explicit no-theme disclosure instead of forcing themes', () => {
    const rendered = renderPeriodicReview({ ...monthlyGoldOutput, mainThemes: [], escalationReminder: null }, 'monthly', '2026-07-01', '2026-07-31');
    expect(rendered).toContain('## 主主题');
    expect(rendered).toContain('不硬凑');
  });

  it('discloses insufficient main themes for monthly in the quality self-check', () => {
    const gated = applyPeriodicQualityGates({ ...monthlyGoldOutput, mainThemes: [] }, 'A', 'monthly');
    expect(gated.qualitySelfCheck).toContain('主主题');
    expect(gated.qualitySelfCheck).toContain('证据不足');
    const weekly = applyPeriodicQualityGates(goldOutput, 'A', 'weekly');
    expect(weekly.qualitySelfCheck).toBe(goldOutput.qualitySelfCheck);
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
