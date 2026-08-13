// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartPage } from '../../src/renderer/pages/start-page';

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
});
