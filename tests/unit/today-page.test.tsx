// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodayPage } from '../../src/renderer/pages/today-page';
import { toLocalDateString } from '../../src/renderer/utils/local-date';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const date = toLocalDateString();
const journal: Journal = { schemaVersion: 1, id: 'journal_today', date, createdAt: `${date}T01:00:00.000Z`, updatedAt: `${date}T01:00:00.000Z`, projectIds: [], body: '原来的日志' };

beforeEach(() => {
  window.zhiji = {
    journals: { create: vi.fn(async (input) => ({ ...journal, ...input })), update: vi.fn(), delete: vi.fn(async () => undefined), list: vi.fn(), get: vi.fn() },
    reviews: { generateDaily: vi.fn(async () => ({}) as never), list: vi.fn(), cancel: vi.fn(), preview: vi.fn(), generatePeriodic: vi.fn() },
  } as unknown as Window['zhiji'];
});

describe('TodayPage', () => {
  it('offers a truthful save action when AI is not configured', () => {
    render(<TodayPage journals={[]} projects={[]} reviews={[]} hasApiKey={false} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    expect(screen.getByRole('button', { name: '保存日志' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /生成今日反馈/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '配置 AI' })).toBeInTheDocument();
  });
  it('starts a blank entry even when today already has a journal', async () => {
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    expect(screen.getByRole('textbox', { name: '日志内容' })).toHaveValue('');
    expect(screen.getByLabelText('日志日期')).toHaveAttribute('max', date);
    expect(screen.queryByText(/自动保存/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '日志内容' }), { target: { value: '新的日志内容' } });
    fireEvent.click(screen.getByRole('button', { name: '仅保存日志' }));
    await waitFor(() => expect(screen.getByText('已保存到本机')).toBeInTheDocument());
    expect(window.zhiji.journals.create).toHaveBeenCalledWith({ date, body: '新的日志内容', projectIds: [] });
  });

  it('retains the draft and exposes a retryable error when saving fails', async () => {
    vi.mocked(window.zhiji.journals.create).mockRejectedValueOnce(new Error('disk full'));
    render(<TodayPage journals={[]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    const editor = screen.getByRole('textbox', { name: '日志内容' });
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
    vi.mocked(window.zhiji.reviews.generateDaily).mockResolvedValueOnce({ kind: 'review', review });
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    fireEvent.change(screen.getByRole('textbox', { name: '日志内容' }), { target: { value: '新内容' } });
    fireEvent.click(screen.getByRole('button', { name: '保存并生成今日反馈' }));
    expect(await screen.findByText('今天最重要的反馈')).toBeInTheDocument();
  });

  it('offers to dive deeper from the daily feedback with the body as prefilled context', async () => {
    const onNavigate = vi.fn();
    const review: Review = { schemaVersion: 1, id: 'review_a1', type: 'daily', periodStart: date, periodEnd: date, sourceIds: [journal.id], projectId: null, provider: 'openai-compatible', model: 'test', promptVersion: 'daily-review-v1', createdAt: `${date}T01:00:00.000Z`, body: '今天最重要的判断：先补现金流。' };
    vi.mocked(window.zhiji.reviews.generateDaily).mockResolvedValueOnce({ kind: 'review', review });
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={onNavigate}/>);
    fireEvent.change(screen.getByRole('textbox', { name: '日志内容' }), { target: { value: '新内容' } });
    fireEvent.click(screen.getByRole('button', { name: '保存并生成今日反馈' }));
    fireEvent.click(await screen.findByRole('button', { name: '就这个深入探讨' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'topics', intent: { type: 'topics.start', question: '今天最重要的判断：先补现金流。', contextExcerpt: '今天最重要的判断：先补现金流。' } });
  });

  it('keeps saving available while pointing an unconfigured user to AI settings', () => {
    const onNavigate = vi.fn(); render(<TodayPage journals={[]} projects={[]} reviews={[]} hasApiKey={false} onRefresh={vi.fn()} onNavigate={onNavigate}/>);
    expect(screen.getByText('日志可直接保存；配置后还能生成反馈。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '配置 AI' })); expect(onNavigate).toHaveBeenCalledWith({ view: 'settings' });
  });

  it('opens past journals from a records intent and focuses writing from a compose intent', async () => {
    const { rerender } = render(<TodayPage journals={[journal]} projects={[]} reviews={[]} intent={{ type: 'records.journals' }} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    expect(screen.getByRole('heading', { name: '过去日志' })).toBeInTheDocument();
    expect(document.querySelector('.history-reader .markdown-document')).toHaveTextContent('原来的日志');
    rerender(<TodayPage journals={[journal]} projects={[]} reviews={[]} intent={{ type: 'journal.compose' }} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    await waitFor(() => expect(screen.getByRole('textbox', { name: '日志内容' })).toHaveFocus());
  });

  it('generates a daily review directly from a historical journal', async () => {
    const pastJournal = { ...journal, id: 'journal_past', date: '2026-08-01', body: '过去的一篇日志' };
    const review: Review = { schemaVersion: 1, id: 'review_past', type: 'daily', periodStart: pastJournal.date, periodEnd: pastJournal.date, sourceIds: [pastJournal.id], projectId: null, provider: 'openai-compatible', model: 'test', promptVersion: 'daily-review-v1', createdAt: `${date}T01:00:00.000Z`, body: '过去这一天的反馈' };
    vi.mocked(window.zhiji.reviews.generateDaily).mockResolvedValueOnce({ kind: 'review', review });
    render(<TodayPage journals={[pastJournal]} projects={[]} reviews={[]} intent={{ type: 'records.journals' }} hasApiKey onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: '生成这一天的反馈' }));
    expect(await screen.findByText('过去这一天的反馈')).toBeInTheDocument();
    expect(window.zhiji.reviews.generateDaily).toHaveBeenCalledWith({ date: pastJournal.date });
  });
  it('moves a historical journal to the recycle bin after confirmation', async () => {
    const refresh = vi.fn();
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} intent={{ type: 'records.journals' }} onRefresh={refresh} onNavigate={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: '移到回收站' }));
    expect(screen.getByText('已有复盘不会同步删除。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认移除' }));
    await waitFor(() => expect(window.zhiji.journals.delete).toHaveBeenCalledWith(journal.id));
    expect(refresh).toHaveBeenCalled();
  });
  it('keeps the journal visible when the recycle bin operation fails', async () => {
    vi.mocked(window.zhiji.journals.delete).mockRejectedValueOnce(new Error('回收站不可用'));
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} intent={{ type: 'records.journals' }} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: '移到回收站' }));
    fireEvent.click(screen.getByRole('button', { name: '确认移除' }));
    expect(await screen.findByText('移除失败：回收站不可用')).toBeInTheDocument();
    expect(document.querySelector('.history-reader .markdown-document')).toHaveTextContent('原来的日志');
  });

  it('generates feedback from an existing journal without creating a duplicate', async () => {
    const review: Review = { schemaVersion: 1, id: 'review_a1', type: 'daily', periodStart: date, periodEnd: date, sourceIds: [journal.id], projectId: null, provider: 'openai-compatible', model: 'test', promptVersion: 'daily-review-v1', createdAt: `${date}T01:00:00.000Z`, body: '已有日志的反馈' };
    vi.mocked(window.zhiji.reviews.generateDaily).mockResolvedValueOnce({ kind: 'review', review });
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: '生成今日反馈' }));
    expect(await screen.findByText('已有日志的反馈')).toBeInTheDocument();
    expect(window.zhiji.journals.create).not.toHaveBeenCalled();
    expect(window.zhiji.reviews.generateDaily).toHaveBeenCalledWith({ date });
  });

  it('lets the user backfill a past date without calling AI', async () => {
    render(<TodayPage journals={[]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('日志日期'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByRole('textbox', { name: '日志内容' }), { target: { value: '补写内容' } });
    fireEvent.click(screen.getByRole('button', { name: '保存日志' }));
    await waitFor(() => expect(window.zhiji.journals.create).toHaveBeenCalledWith({ date: '2026-08-01', body: '补写内容', projectIds: [] }));
    expect(window.zhiji.reviews.generateDaily).not.toHaveBeenCalled();
  });

  it('keeps an unsaved draft when the user cancels opening history', () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    render(<TodayPage journals={[journal]} projects={[]} reviews={[]} onRefresh={vi.fn()} onNavigate={vi.fn()}/>);
    fireEvent.change(screen.getByRole('textbox', { name: '日志内容' }), { target: { value: '未保存草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '过去日志' }));
    expect(screen.getByRole('textbox', { name: '日志内容' })).toHaveValue('未保存草稿');
  });
});
