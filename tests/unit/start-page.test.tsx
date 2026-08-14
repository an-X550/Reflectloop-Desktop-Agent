// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartPage } from '../../src/renderer/pages/start-page';

beforeEach(() => {
  window.zhiji = {
    intent: { resolve: vi.fn(async () => ({ kind: 'matched', intent: 'weekly-review', source: 'deterministic', reason: '命中周复盘关键词' })) },
  } as unknown as Window['zhiji'];
});

describe('StartPage', () => {
  it('shows one primary recommendation and three quiet capability entrances', () => {
    const onNavigate = vi.fn();
    render(<StartPage journals={[]} reviews={[]} hasApiKey onNavigate={onNavigate}/>);

    expect(screen.getByRole('heading', { name: '写下今天的经历' })).toBeInTheDocument();
    expect(screen.getByText('今天还没有记录。一段真实经历就够了。')).toBeInTheDocument();
    expect(document.querySelectorAll('.btn--primary')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '开始记录' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'journal', intent: { type: 'journal.compose' } });
    fireEvent.click(screen.getByRole('button', { name: /^做复盘/ }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'reviews' });
    fireEvent.click(screen.getByRole('button', { name: /^查看记录/ }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'journal', intent: { type: 'records.journals' } });
    fireEvent.click(screen.getByRole('button', { name: /^管理项目/ }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'projects' });
  });

  it('states AI availability without turning configuration into the main task', () => {
    render(<StartPage journals={[]} reviews={[]} hasApiKey={false} onNavigate={vi.fn()}/>);
    expect(screen.getByText(/AI 尚未配置/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始记录' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '配置 AI' })).not.toBeInTheDocument();
  });

  it('routes a matched intent to the existing page instead of inventing a flow', async () => {
    const onNavigate = vi.fn();
    render(<StartPage journals={[]} reviews={[]} hasApiKey onNavigate={onNavigate}/>);
    fireEvent.change(screen.getByLabelText('意图描述'), { target: { value: '本周复盘' } });
    fireEvent.click(screen.getByRole('button', { name: '出发' }));
    const go = await screen.findByRole('button', { name: '前往：周复盘' });
    expect(window.zhiji.intent.resolve).toHaveBeenCalledWith({ text: '本周复盘' });
    fireEvent.click(go);
    expect(onNavigate).toHaveBeenCalledWith({ view: 'reviews', intent: { type: 'review.weekly' } });
  });

  it('shows a clarification question when the intent cannot be resolved', async () => {
    vi.mocked(window.zhiji.intent.resolve).mockResolvedValueOnce({ kind: 'clarify', question: '你是想写日志、做复盘，还是讨论一个主题？' });
    const onNavigate = vi.fn();
    render(<StartPage journals={[]} reviews={[]} hasApiKey onNavigate={onNavigate}/>);
    fireEvent.change(screen.getByLabelText('意图描述'), { target: { value: '随便看看' } });
    fireEvent.click(screen.getByRole('button', { name: '出发' }));
    expect(await screen.findByText('你是想写日志、做复盘，还是讨论一个主题？')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^前往/ })).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
