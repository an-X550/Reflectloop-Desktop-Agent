// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../src/renderer/pages/settings-page';

beforeEach(() => {
  window.zhiji = {
    profile: { get: vi.fn(async () => null), save: vi.fn(async (input) => ({ schemaVersion: 1, ...input, createdAt: '2026-08-13T00:00:00.000Z', updatedAt: '2026-08-13T00:00:00.000Z' })), clear: vi.fn(async () => undefined) },
    dataDirectory: { getInfo: vi.fn(async () => ({ path: 'D:\\知己', writable: true, fileCount: 6, totalBytes: 100, categories: { journals: 3, reviews: 2, projects: 1, profile: 0, settings: 0 } })), open: vi.fn(async () => undefined) },
    transfer: { exportBackup: vi.fn(async () => ({ canceled: true })), previewRestore: vi.fn(async () => ({ canceled: true })), restore: vi.fn(async () => ({ fileCount: 0 })) },
    settings: {
      getPublicConfig: vi.fn(async () => ({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', hasApiKey: true })),
      save: vi.fn(async () => ({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', hasApiKey: true })),
      clearApiKey: vi.fn(async () => ({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', hasApiKey: false })),
      testConnection: vi.fn(async () => undefined),
    },
  } as unknown as Window['zhiji'];
});

describe('SettingsPage', () => {
  it('groups configuration under one clear settings page', async () => {
    render(<SettingsPage/>);
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI 服务' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '本地数据' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '个人背景' })).toBeInTheDocument();
  });
  it('shows three provider cards and only reveals the custom URL field when needed', async () => {
    render(<SettingsPage/>);
    expect(await screen.findByRole('button', { name: /^O OpenAI/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^D DeepSeek/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^自 自定义/ })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'API 地址' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^自 自定义/ }));
    expect(screen.getByRole('textbox', { name: 'API 地址' })).toBeInTheDocument();
  });

  it('shows a saved-key badge without ever echoing the key', async () => {
    render(<SettingsPage/>);
    expect(await screen.findByText(/已安全保存/)).toBeInTheDocument();
    const input = screen.getByLabelText('API Key');
    expect(input).toHaveValue('');
    expect(document.body).not.toHaveTextContent('sk-secret');
  });

  it('keeps test and save loading states independent', async () => {
    let finishTest!: () => void;
    vi.mocked(window.zhiji.settings.testConnection).mockReturnValueOnce(new Promise<void>((resolve) => { finishTest = resolve; }));
    render(<SettingsPage/>);
    await screen.findByText(/已安全保存/);
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-secret' } });
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    expect(screen.getByRole('button', { name: '请稍候…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存设置' })).toBeEnabled();
    finishTest();
    await waitFor(() => expect(screen.getByText(/连接成功/)).toBeInTheDocument());
  });

  it('persists a working provider configuration after a successful connection test', async () => {
    const onSaved = vi.fn();
    render(<SettingsPage onSaved={onSaved}/>);
    await screen.findByText(/已安全保存/);
    fireEvent.click(screen.getByRole('button', { name: /^D DeepSeek/ }));
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'deepseek-chat' } });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-deepseek' } });
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    const expected = { providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: 'sk-deepseek' };
    await waitFor(() => expect(window.zhiji.settings.testConnection).toHaveBeenCalledWith(expected));
    expect(window.zhiji.settings.save).toHaveBeenCalledWith(expected);
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByText('连接成功，设置已安全保存')).toBeInTheDocument();
  });
  it('removes the saved key after explicit confirmation and refreshes global AI state', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    const onSaved = vi.fn();
    render(<SettingsPage onSaved={onSaved}/>);
    await screen.findByText(/已安全保存/);
    fireEvent.click(screen.getByRole('button', { name: '移除已保存 Key' }));
    await waitFor(() => expect(window.zhiji.settings.clearApiKey).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByText('已移除当前服务商的 API Key')).toBeInTheDocument();
  });

  it('requires a verified preview before restoring local data', async () => {
    vi.mocked(window.zhiji.transfer.previewRestore).mockResolvedValueOnce({ canceled: false, previewId: 'preview-id', archivePath: 'backup.zhiji.zip', exportedAt: '2026-08-13T00:00:00.000Z', appVersion: '1.0.0', fileCount: 6, totalBytes: 100, categories: { journals: 3, reviews: 2, projects: 1, profile: 0, settings: 0 } });
    render(<SettingsPage/>);
    expect(screen.queryByRole('button', { name: '确认恢复' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '选择备份并校验' }));
    expect(await screen.findByText('备份校验通过：6 个文件')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认恢复' }));
    await waitFor(() => expect(window.zhiji.transfer.restore).toHaveBeenCalledWith('preview-id'));
  });

  it('shows and opens the actual local data directory', async () => {
    render(<SettingsPage/>);
    expect(await screen.findByText('D:\\知己')).toBeInTheDocument();
    expect(screen.getByText(/6 个文件/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开数据文件夹' }));
    await waitFor(() => expect(window.zhiji.dataDirectory.open).toHaveBeenCalled());
  });

  it('saves explicit personal background without enabling AI use by default', async () => {
    render(<SettingsPage/>); const editor = await screen.findByRole('textbox', { name: '个人背景' });
    fireEvent.change(editor, { target: { value: '我偏好先验证再扩展。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存个人背景' }));
    await waitFor(() => expect(window.zhiji.profile.save).toHaveBeenCalledWith({ body: '我偏好先验证再扩展。', enabledForAi: false }));
  });

  it('explains that enabling the profile affects AI analysis', async () => {
    render(<SettingsPage/>);
    expect(await screen.findByText('允许 AI 在复盘和方向校准中使用')).toBeInTheDocument();
    expect(screen.queryByText(/暂不注入分析/)).not.toBeInTheDocument();
  });
});
