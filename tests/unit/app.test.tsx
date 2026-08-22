// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/app/app';

function api() {
  return {
    dataDirectory: { getInfo: vi.fn(async () => ({ path: 'D:\\知己', writable: true, fileCount: 0, totalBytes: 0, categories: { journals: 0, reviews: 0, projects: 0, profile: 0, settings: 0 } })), open: vi.fn(), pickFolder: vi.fn(async () => ({ canceled: true })), changeLocation: vi.fn() },
    agent: { start: vi.fn(), send: vi.fn(), cancel: vi.fn(), list: vi.fn(async () => []), get: vi.fn(), onEvent: vi.fn(() => () => undefined) },
    profile: { get: vi.fn(async () => null), save: vi.fn(), clear: vi.fn() },
    transfer: { exportBackup: vi.fn(), previewRestore: vi.fn(), restore: vi.fn() },
    journals: { list: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), get: vi.fn() },
    projects: { list: vi.fn(async () => []), create: vi.fn(), archive: vi.fn() },
    reviews: { list: vi.fn(async () => []), generateDaily: vi.fn(), cancel: vi.fn(), preview: vi.fn(), generatePeriodic: vi.fn(), onTaskPhase: vi.fn(() => () => undefined) },
    templates: { list: vi.fn(async () => []), get: vi.fn(), save: vi.fn(), delete: vi.fn() },
    app: { getInfo: vi.fn(async () => ({ version: '1.27.0', updateUrl: null })), setUpdateUrl: vi.fn() },
    settings: { getPublicConfig: vi.fn(async () => ({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', agentThinking: 'disabled' as const, hasApiKey: false })), save: vi.fn(), testConnection: vi.fn() },
  } as unknown as Window['zhiji'];
}

beforeEach(() => { window.zhiji = api(); });

describe('App', () => {
  it('navigates across the product pages', async () => {
    render(<App/>);
    await screen.findByRole('heading', { name: '写下今天的经历' });
    for (const [nav, heading] of [['日志', '写一条日志'], ['复盘', '把一段时间的经历放在一起看'], ['项目', '项目与关联日志'], ['设置', '设置']] as const) {
      fireEvent.click(screen.getByRole('button', { name: nav }));
      expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: '知己 Agent' }));
    expect(screen.getByRole('heading', { name: '知己 Agent', level: 2 })).toBeInTheDocument();
  });

  it('recovers from an initial load failure with Retry', async () => {
    vi.mocked(window.zhiji.journals.list).mockRejectedValueOnce(new Error('磁盘暂不可用')).mockResolvedValueOnce([]);
    render(<App/>);
    expect(await screen.findByText('磁盘暂不可用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '写下今天的经历' })).toBeInTheDocument());
    expect(window.zhiji.journals.list).toHaveBeenCalledTimes(2);
  });
});
