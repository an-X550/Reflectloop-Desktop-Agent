// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../src/renderer/app/app-shell';

describe('AppShell', () => {
  it('marks the active destination and navigates through the product areas', () => {
    const onNavigate = vi.fn();
    render(<AppShell view="reviews" onNavigate={onNavigate} connectionReady dataPath="D:\知己"><p>内容</p></AppShell>);

    expect(screen.getAllByRole('button', { name: /开始|知己 Agent|日志|复盘|项目|设置/ })).toHaveLength(6);
    expect(screen.getByRole('button', { name: '复盘' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: '日志' }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'journal' });
    expect(screen.getByText('数据留在本机')).toBeInTheDocument();
    expect(screen.getByText('D:\\知己')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /数据留在本机/ }));
    expect(onNavigate).toHaveBeenCalledWith({ view: 'settings' });
    expect(screen.getByText('AI 已配置')).toBeInTheDocument();
  });
});
