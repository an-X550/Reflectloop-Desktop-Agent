// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../src/renderer/app/app-shell';

describe('AppShell', () => {
  it('marks the active destination and navigates through the five product areas', () => {
    const onNavigate = vi.fn();
    render(<AppShell view="reviews" onNavigate={onNavigate} connectionReady dataPath="D:\知己"><p>内容</p></AppShell>);

    expect(screen.getAllByRole('button', { name: /今天|复盘|项目|历史|设置/ })).toHaveLength(5);
    expect(screen.getByRole('button', { name: '复盘' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: '历史' }));
    expect(onNavigate).toHaveBeenCalledWith('history');
    expect(screen.getByText('数据留在本机')).toBeInTheDocument();
    expect(screen.getByText('D:\\知己')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /数据留在本机/ }));
    expect(onNavigate).toHaveBeenCalledWith('settings');
    expect(screen.getByText('AI 已配置')).toBeInTheDocument();
  });
});
