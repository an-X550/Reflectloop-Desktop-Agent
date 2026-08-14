import { describe, expect, it } from 'vitest';
import { buildDailyEvidence } from '../../src/main-process/skill-runtime/daily-evidence';
import type { Journal } from '../../src/shared/schemas/domain';

/**
 * R2 金样本回归集（docs/2026-08-14-r2-evidence-grading-comparison.md）。
 * 样本全部来自真实日志（脱敏：去人名昵称），语义判级按 .claude/shared/contracts/journal-input.md。
 * 断言口径：
 * - expectedRegexGrade 是正则层（buildDailyEvidence）的判级真相；
 *   S2/N1/N2 这类短小第一人称评价在正则层仍判 D，修复点在运行时的 D 级语义复核
 *   （见 daily-runtime.test.ts），不在正则层。
 * - generatesFeedback 是该样本最终是否应生成反馈（正则判级非 D，或经 D 级复核后升级）。
 */
const journal = (body: string): Journal => ({
  schemaVersion: 1,
  id: 'journal_gold',
  date: '2026-08-14',
  createdAt: '2026-08-14T08:00:00.000Z',
  updatedAt: '2026-08-14T08:00:00.000Z',
  projectIds: [],
  body,
});

interface GoldSample {
  name: string;
  body: string;
  expectedRegexGrade: 'A' | 'B' | 'C' | 'D';
  generatesFeedback: boolean;
  needsGradeReview?: boolean;
}

// 基线 5 条：2026-08-14 对照报告的实测样本原文（脱敏）
const baselineSamples: GoldSample[] = [
  {
    name: 'S1 评价+意图（正则与语义一致为 B）',
    body: '思考🤔，每天把日志全部直接放在朋友圈不是一个好的选择，这与用费曼学习法改进思考背道而驰。日志又臭又长，没人愿意读的。明天只写觉得有意义的内容。',
    expectedRegexGrade: 'B',
    generatesFeedback: true,
  },
  {
    name: 'S2 短小第一人称评价（正则误判 D，语义至少 C）',
    body: '日志分享是对的，期待多多交流。',
    expectedRegexGrade: 'D',
    generatesFeedback: true,
    needsGradeReview: true,
  },
  {
    name: 'S3 疑问式解释俱全（语义 A，正则 C；A/B/C 级差本轮不修）',
    body: '今天我用6分钟核对知己闭环，完成了提醒、分析和分发步骤检查。过程清楚，但我还不知道实际使用时是否会漏掉行动。明天我会用2分钟打开生成报告，核对一级标题和行动是否一致。',
    expectedRegexGrade: 'C',
    generatesFeedback: true,
  },
  {
    name: 'S4 解释+弱意图（语义 A，正则 B；A/B/C 级差本轮不修）',
    body: '不想写日志了，每次写日志都是在晚上 23:00-1:00 左右，每日必做，让我觉得有些像被摊牌的任务，像工作一样了，没有自驱力。但是我又知道日志花时间很短，应该坚持。',
    expectedRegexGrade: 'B',
    generatesFeedback: true,
  },
  {
    name: 'S5 评价+意图（语义 B，正则 C；A/B/C 级差本轮不修）',
    body: '上班第七天，包括周末，我已经9天没有学习行测了。并非没有时间学习，磨蹭下班，看社媒，搜集经验，用知己分析日志，做主题思考，企图通过前期想明白，打到后期快速发展的成果。但这是完全不可行的。明天不做其他，空闲时间只学行测试试。',
    expectedRegexGrade: 'C',
    generatesFeedback: true,
  },
];

// 新增 5 条：2 条短小第一人称评价（D 误熔断高发形态）、2 条疑问式解释、1 条模板日志
const newSamples: GoldSample[] = [
  {
    name: 'N1 短评价（价值点短句，正则误判 D，语义 C）',
    body: '和前辈聊了聊天，收获蛮多。',
    expectedRegexGrade: 'D',
    generatesFeedback: true,
    needsGradeReview: true,
  },
  {
    name: 'N2 短评价（无连接词的本人事件，正则误判 D，语义 C）',
    body: '任何事物都有保质期，用了三年的鼠标坏了。',
    expectedRegexGrade: 'D',
    generatesFeedback: true,
    needsGradeReview: true,
  },
  {
    name: 'N3 疑问式解释（为什么+因为自答）',
    body: '为什么我会刷视频逃避学习，因为难度低，多巴胺分泌多。',
    expectedRegexGrade: 'B',
    generatesFeedback: true,
  },
  {
    name: 'N4 疑问式解释（自我追问归因）',
    body: '为什么我会这样子操作，因为之前没有完整留出周末两天对时间思考复盘。',
    expectedRegexGrade: 'C',
    generatesFeedback: true,
  },
  {
    name: 'N5 模板日志（四类齐全，正则快路径 A）',
    body: '开心的事情:\n1. 和朋友吃了美式烤肉，慢熟牛肉挺不错的。\n充实的事情:\n1. 开发知己软件，蛮好用的。\n思考:\n1. 因为额度紧张，所以今晚早点休息，明天继续。',
    expectedRegexGrade: 'A',
    generatesFeedback: true,
  },
];

const goldSamples = [...baselineSamples, ...newSamples];

describe('R2 gold samples: regex grading baseline', () => {
  it('has at least 10 gold samples', () => {
    expect(goldSamples.length).toBeGreaterThanOrEqual(10);
  });

  it.each(goldSamples.map((sample) => [sample.name, sample] as const))(
    'grades "%s" at the regex layer as documented',
    (_, sample) => {
      expect(buildDailyEvidence([journal(sample.body)]).grade).toBe(sample.expectedRegexGrade);
    },
  );
});
