// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatternPanel } from '../../src/renderer/features/patterns/pattern-panel';
import type { Review, VerifiedPattern } from '../../src/shared/schemas/domain';

const review: Review = {
  schemaVersion: 2, id: 'review_a1', type: 'weekly', periodStart: '2026-08-10', periodEnd: '2026-08-16',
  sourceIds: ['journal_a1'], sourceVersions: [], projectId: null, provider: 'openai-compatible', model: 'fake',
  promptVersion: 'periodic-review-v2', createdAt: '2026-08-16T10:00:00.000Z', body: '本周上午专注有效',
};

const confirmedPattern: VerifiedPattern = {
  schemaVersion: 1, id: 'pattern_x1', statement: '已确认的旧模式', evidenceSummary: '旧证据', sourceReviewIds: ['review_old'], createdAt: '2026-08-01T10:00:00.000Z',
};

const candidate = { statement: '上午先关闭消息时更容易完成核心交付', evidenceSummary: '本周三次上午专注后完成交付', sourceReviewIds: ['review_a1'] };

beforeEach(() => {
  window.zhiji = {
    patterns: {
      list: vi.fn(async () => [confirmedPattern]),
      propose: vi.fn(async () => [candidate]),
      confirm: vi.fn(async (input) => ({ schemaVersion: 1, id: 'pattern_new1', ...input, createdAt: '2026-08-16T12:00:00.000Z' })),
    },
  } as unknown as Window['zhiji'];
});

describe('PatternPanel', () => {
  it('lists confirmed patterns without calling the model', async () => {
    render(<PatternPanel review={review}/>);
    expect(await screen.findByText('已确认的旧模式')).toBeInTheDocument();
    expect(window.zhiji.patterns.propose).not.toHaveBeenCalled();
  });

  it('proposes candidates only when the user asks and never persists them directly', async () => {
    render(<PatternPanel review={review}/>);
    await screen.findByText('已确认的旧模式');
    fireEvent.click(screen.getByRole('button', { name: '提取验证模式候选' }));
    expect(await screen.findByText(candidate.statement)).toBeInTheDocument();
    expect(screen.getByText(candidate.evidenceSummary)).toBeInTheDocument();
    expect(window.zhiji.patterns.propose).toHaveBeenCalledWith({ reviewId: 'review_a1' });
    expect(window.zhiji.patterns.confirm).not.toHaveBeenCalled();
  });

  it('persists a candidate only after explicit user confirmation', async () => {
    render(<PatternPanel review={review}/>);
    await screen.findByText('已确认的旧模式');
    fireEvent.click(screen.getByRole('button', { name: '提取验证模式候选' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认沉淀' }));
    await waitFor(() => expect(window.zhiji.patterns.confirm).toHaveBeenCalledWith(candidate));
    expect(await screen.findByText('已确认的旧模式')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认沉淀' })).not.toBeInTheDocument();
  });

  it('drops a rejected candidate without any persistence call', async () => {
    render(<PatternPanel review={review}/>);
    await screen.findByText('已确认的旧模式');
    fireEvent.click(screen.getByRole('button', { name: '提取验证模式候选' }));
    fireEvent.click(await screen.findByRole('button', { name: '拒绝' }));
    expect(screen.queryByText(candidate.statement)).not.toBeInTheDocument();
    expect(window.zhiji.patterns.confirm).not.toHaveBeenCalled();
  });
});
