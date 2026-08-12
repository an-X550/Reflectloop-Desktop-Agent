// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../src/renderer/pages/settings-page';

beforeEach(() => {
  window.zhiji = {
    settings: {
      getPublicConfig: vi.fn(async () => ({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', hasApiKey: true })),
      save: vi.fn(async () => ({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', hasApiKey: true })),
      testConnection: vi.fn(async () => undefined),
    },
  } as unknown as Window['zhiji'];
});

describe('SettingsPage', () => {
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
    await waitFor(() => expect(screen.getByText('连接成功')).toBeInTheDocument());
  });
});
