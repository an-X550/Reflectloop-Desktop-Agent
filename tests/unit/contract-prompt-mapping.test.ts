import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DAILY_REVIEW_SYSTEM_PROMPT } from '../../src/main-process/prompts/daily-review-v1';
import { periodicSystemPrompt } from '../../src/main-process/prompts/periodic-review-v1';

// 契约-提示词漂移防护（契约审计 R1）：关键禁令文本必须同时存在于桌面端提示词中。
// 同源关系登记在 docs/contract-prompt-mapping.md；契约侧变更时先改对照表再改提示词。

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const promptsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/main-process/prompts');

describe('contract-prompt mapping (R1 drift guard)', () => {
  it('registers the mapping table in docs', async () => {
    const mapping = await readFile(path.join(docsRoot, 'contract-prompt-mapping.md'), 'utf8');
    expect(mapping).toContain('daily-feedback.md');
    expect(mapping).toContain('review-synthesis.md');
    expect(mapping).toContain('topic-thinking.md');
    expect(mapping).toContain('daily-review-v1.ts');
    expect(mapping).toContain('periodic-review-v1.ts');
  });

  it('keeps shared prohibitions in daily and periodic prompts', () => {
    const periodic = periodicSystemPrompt('weekly', 'A');
    for (const text of ['不得编造事实', '不得做确定性心理归因', '不得把单一事件拔高为价值观']) {
      expect(DAILY_REVIEW_SYSTEM_PROMPT, `daily prompt missing: ${text}`).toContain(text);
      expect(periodic, `periodic prompt missing: ${text}`).toContain(text);
    }
  });

  it('keeps the no-fabrication closure rule for prior actions', () => {
    expect(DAILY_REVIEW_SYSTEM_PROMPT).toContain('不能推断未做');
  });

  it('keeps the verification-candidate rule that only users confirm patterns', async () => {
    const source = await readFile(path.join(promptsRoot, 'verified-patterns-v1.ts'), 'utf8');
    expect(source).toContain('不得编造日期、次数或引文');
    expect(source).toContain('由用户决定是否沉淀');
  });

  it('keeps prompt sources free of .claude runtime references', async () => {
    const mapping = await readFile(path.join(docsRoot, 'contract-prompt-mapping.md'), 'utf8');
    expect(mapping).toContain('运行时不依赖');
  });
});
