// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsPage } from '../../src/renderer/pages/reviews-page';
import type { Project, Review } from '../../src/shared/schemas/domain';

const project: Project = { schemaVersion: 1, id: 'project_a1', name: '知己客户端', status: 'active', createdAt: '2026-08-01T00:00:00.000Z', archivedAt: null };
const historicalReview: Review = { schemaVersion: 1, id: 'review_history', type: 'monthly', periodStart: '2026-07-01', periodEnd: '2026-07-31', sourceIds: [], projectId: null, provider: 'openai-compatible', model: 'test', promptVersion: 'monthly-review-v1', createdAt: '2026-07-31T00:00:00.000Z', body: '七月复盘正文' };

beforeEach(() => { window.zhiji = { reviews: { preview: vi.fn(async () => ({ token: 'token', type: 'weekly', start: '2026-08-10', end: '2026-08-16', sources: [{ id: 'journal_a1', date: '2026-08-13', excerpt: '真实材料' }] })), generatePeriodic: vi.fn(async () => ({ schemaVersion: 1, id: 'review_a1', type: 'weekly', periodStart: '2026-08-10', periodEnd: '2026-08-16', sourceIds: ['journal_a1'], projectId: null, provider: 'openai-compatible', model: 'test', promptVersion: 'weekly-review-v1', createdAt: '2026-08-13T00:00:00.000Z', body: '本周有效行动' })), cancel: vi.fn(), list: vi.fn(), generateDaily: vi.fn() } } as unknown as Window['zhiji']; });

describe('ReviewsPage', () => {
  it('starts from three prototype review cards and uses a sensible weekly range', () => {
    render(<ReviewsPage projects={[]}/>);
    expect(screen.getByText('本周复盘')).toBeInTheDocument(); expect(screen.getByText('本月复盘')).toBeInTheDocument(); expect(screen.getByText('项目复盘')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '预览本周材料' }));
    expect(screen.queryByLabelText('开始日期')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '调整日期' }));
    expect(screen.getByLabelText('开始日期')).toHaveValue('2026-08-10'); expect(screen.getByLabelText('结束日期')).toHaveValue('2026-08-16');
  });

  it('invalidates a preview after range changes and enables generation only after preview', async () => {
    render(<ReviewsPage projects={[]}/>); fireEvent.click(screen.getByRole('button', { name: '预览本周材料' })); fireEvent.click(screen.getByRole('button', { name: '调整日期' })); fireEvent.click(screen.getByRole('button', { name: '预览材料' }));
    await screen.findByText('真实材料'); expect(screen.getByRole('button', { name: '确认并生成' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-08-15' } });
    expect(screen.getByRole('button', { name: '确认并生成' })).toBeDisabled();
  });

  it('shows a history action after successful generation', async () => {
    render(<ReviewsPage projects={[]}/>); fireEvent.click(screen.getByRole('button', { name: '预览本周材料' })); fireEvent.click(screen.getByRole('button', { name: '预览材料' })); await screen.findByText('真实材料'); fireEvent.click(screen.getByRole('button', { name: '确认并生成' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '查看历史复盘' })).toBeInTheDocument()); fireEvent.click(screen.getByRole('button', { name: '查看历史复盘' })); expect(screen.getByRole('heading', { name: '历史复盘' })).toBeInTheDocument();
    expect(screen.getByText('本周有效行动', { selector: 'pre' })).toBeInTheDocument();
  });

  it('applies weekly and project navigation intents and keeps review history in this page', () => {
    const { rerender } = render(<ReviewsPage projects={[project]} reviews={[historicalReview]} intent={{ type: 'review.weekly' }}/>);
    expect(screen.getByRole('heading', { name: '本周复盘设置' })).toBeInTheDocument();
    rerender(<ReviewsPage projects={[project]} reviews={[historicalReview]} intent={{ type: 'review.project', projectId: project.id }}/>);
    expect(screen.getByLabelText('项目（可选）')).toHaveValue(project.id);
    fireEvent.click(screen.getByRole('button', { name: '历史复盘' }));
    expect(screen.getByText('七月复盘正文', { selector: 'pre' })).toBeInTheDocument();
  });
});
