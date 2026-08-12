// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsPage } from '../../src/renderer/pages/reviews-page';

beforeEach(() => { window.zhiji = { reviews: { preview: vi.fn(async () => ({ token: 'token', type: 'weekly', start: '2026-08-10', end: '2026-08-16', sources: [{ id: 'journal_a1', date: '2026-08-13', excerpt: '真实材料' }] })), generatePeriodic: vi.fn(async () => ({})), cancel: vi.fn(), list: vi.fn(), generateDaily: vi.fn() } } as unknown as Window['zhiji']; });

describe('ReviewsPage', () => {
  it('starts from three prototype review cards and uses a sensible weekly range', () => {
    render(<ReviewsPage projects={[]} onNavigate={vi.fn()}/>);
    expect(screen.getByText('本周复盘')).toBeInTheDocument(); expect(screen.getByText('本月复盘')).toBeInTheDocument(); expect(screen.getByText('项目复盘')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '预览本周材料' }));
    expect(screen.getByLabelText('开始日期')).toHaveValue('2026-08-10');
    expect(screen.getByLabelText('结束日期')).toHaveValue('2026-08-16');
  });

  it('invalidates a preview after range changes and enables generation only after preview', async () => {
    render(<ReviewsPage projects={[]} onNavigate={vi.fn()}/>); fireEvent.click(screen.getByRole('button', { name: '预览本周材料' })); fireEvent.click(screen.getByRole('button', { name: '预览材料' }));
    await screen.findByText('真实材料'); expect(screen.getByRole('button', { name: '确认并生成' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-08-15' } });
    expect(screen.getByRole('button', { name: '确认并生成' })).toBeDisabled();
  });

  it('shows a history action after successful generation', async () => {
    const onNavigate = vi.fn(); render(<ReviewsPage projects={[]} onNavigate={onNavigate}/>); fireEvent.click(screen.getByRole('button', { name: '预览本周材料' })); fireEvent.click(screen.getByRole('button', { name: '预览材料' })); await screen.findByText('真实材料'); fireEvent.click(screen.getByRole('button', { name: '确认并生成' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '去历史查看' })).toBeInTheDocument()); fireEvent.click(screen.getByRole('button', { name: '去历史查看' })); expect(onNavigate).toHaveBeenCalledWith('history');
  });
});
