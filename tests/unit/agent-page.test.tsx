// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPage } from '../../src/renderer/pages/agent-page';
import type { AgentEvent } from '../../src/shared/schemas/agent';

const session = { id: 'agent_abc123', title: '周复盘', status: 'idle' as const, messages: [], createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z' };

beforeEach(() => {
  window.zhiji = { agent: { start: vi.fn(async () => session), send: vi.fn(), cancel: vi.fn(), list: vi.fn(async () => [session]), get: vi.fn(), onEvent: vi.fn(() => () => undefined) } } as unknown as Window['zhiji'];
});

describe('AgentPage', () => {
  it('shows sessions and sends a natural-language message through the named API', async () => {
    render(<AgentPage/>);
    expect((await screen.findAllByText('周复盘')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('textbox', { name: '向知己 Agent 发送消息' }), { target: { value: '先整理本周' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(window.zhiji.agent.send).toHaveBeenCalledWith({ sessionId: 'agent_abc123', message: '先整理本周' }));
  });

  it('treats validated Agent navigation and result cards as data', async () => {
    let listener: ((event: AgentEvent) => void) | undefined;
    const onNavigate = vi.fn();
    window.zhiji.agent.onEvent = vi.fn((next) => { listener = next; return () => undefined; });
    render(<AgentPage onNavigate={onNavigate}/>);
    await waitFor(() => expect(listener).toBeTypeOf('function'));
    listener?.({ type: 'ui.navigate', sessionId: 'agent_abc123', target: { view: 'reviews', intent: 'project', projectId: 'project_valid1' } });
    listener?.({ type: 'ui.present', sessionId: 'agent_abc123', card: { title: '下一步', summary: '查看该项目的复盘。', links: [{ label: '打开项目复盘', target: { view: 'reviews', intent: 'project', projectId: 'project_valid1' } }] } });

    expect(onNavigate).toHaveBeenCalledWith({ view: 'reviews', intent: { type: 'review.project', projectId: 'project_valid1' } });
    expect(await screen.findByText('下一步')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开项目复盘' }));
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });
});
