// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodayPage } from '../../src/renderer/pages/today-page';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const date = new Date().toISOString().slice(0, 10);
const journal: Journal = { schemaVersion: 1, id: 'journal_today', date, createdAt: `${date}T01:00:00.000Z`, updatedAt: `${date}T01:00:00.000Z`, projectIds: [], body: '原来的日志' };

beforeEach(() => {
  window.zhiji = {
    journals: { save: vi.fn(async (input) => ({ ...journal, ...input, id: input.id ?? journal.id })), list: vi.fn(), get: vi.fn() },
    reviews: { generateDaily: vi.fn(async () => ({}) as never), list: vi.fn(), cancel: vi.fn(), preview: vi.fn(), generatePeriodic: vi.fn() },
  } as unknown as Window['zhiji'];
});

describe('TodayPage', () => {
  it('loads the existing journal, saves explicitly and never claims autosave', async () => {
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    expect(screen.getByRole('textbox', { name: '今日日志' })).toHaveValue('原来的日志');
    expect(screen.queryByText(/自动保存/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '今日日志' }), { target: { value: '新的日志内容' } });
    fireEvent.click(screen.getByRole('button', { name: '仅保存日志' }));
    await waitFor(() => expect(screen.getByText('已保存到本机')).toBeInTheDocument());
  });

  it('retains the draft and exposes a retryable error when saving fails', async () => {
    vi.mocked(window.zhiji.journals.save).mockRejectedValueOnce(new Error('disk full'));
    render(<TodayPage journals={[]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    const editor = screen.getByRole('textbox', { name: '今日日志' });
    fireEvent.change(editor, { target: { value: '不能丢失的草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '仅保存日志' }));
    await waitFor(() => expect(screen.getByText(/保存失败/)).toBeInTheDocument());
    expect(editor).toHaveValue('不能丢失的草稿');
  });

  it('limits recent journals to three items', () => {
    const journals = Array.from({ length: 5 }, (_, index) => ({ ...journal, id: `journal_a${index}`, date: `2026-08-0${index + 1}`, body: `日志 ${index}` }));
    render(<TodayPage journals={journals} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    expect(screen.getAllByTestId('recent-journal')).toHaveLength(3);
  });

  it('shows the generated daily review without forcing a history jump', async () => {
    const review: Review = { schemaVersion: 1, id: 'review_a1', type: 'daily', periodStart: date, periodEnd: date, sourceIds: [journal.id], projectId: null, provider: 'openai-compatible', model: 'test', promptVersion: 'daily-review-v1', createdAt: `${date}T01:00:00.000Z`, body: '今天最重要的反馈' };
    vi.mocked(window.zhiji.reviews.generateDaily).mockResolvedValueOnce(review);
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: '生成今日反馈' }));
    expect(await screen.findByText('今天最重要的反馈')).toBeInTheDocument();
  });

  it('keeps saving available while pointing an unconfigured user to AI settings', () => {
    const onNavigate = vi.fn(); render(<TodayPage journals={[]} projects={[]} reviews={[]} hasApiKey={false} onRefresh={vi.fn()} onNavigate={onNavigate}/>);
    expect(screen.getByText('先保存日志也可以')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '配置 AI' })); expect(onNavigate).toHaveBeenCalledWith('settings');
  });
});
