// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPage } from '../../src/renderer/pages/agent-page';

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
});
