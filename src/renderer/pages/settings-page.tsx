import { useEffect, useState } from 'react';
import type { SaveProviderConfigInput } from '../../shared/schemas/ipc';
import { Button } from '../components/button';
import { Field } from '../components/field';
import { PageHeader } from '../components/page-header';
import { StatusBanner } from '../components/status-banner';
import { ProviderCard } from '../features/settings/provider-card';

const presets = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
} as const;

export function SettingsPage({ onSaved }: { onSaved?(): void | Promise<void> }) {
  const [form, setForm] = useState<SaveProviderConfigInput>({ providerId: 'openai', ...presets.openai });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  useEffect(() => { void window.zhiji.settings.getPublicConfig().then(({ hasApiKey: saved, ...config }) => { setForm(config); setHasApiKey(saved); }); }, []);
  const updateProvider = (providerId: SaveProviderConfigInput['providerId']) => {
    setMessage(''); setError('');
    setForm((old) => ({ ...old, providerId, ...(providerId === 'custom' ? {} : presets[providerId]) }));
  };
  const run = async (kind: 'save' | 'test') => {
    setBusy(kind); setMessage(''); setError('');
    try {
      if (kind === 'save') {
        const result = await window.zhiji.settings.save(form);
        setHasApiKey(result.hasApiKey);
        await onSaved?.();
      } else await window.zhiji.settings.testConnection(form);
      setForm(({ apiKey: _discard, ...rest }) => rest);
      setMessage(kind === 'save' ? '设置已安全保存' : '连接成功');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '请检查配置后重试'); }
    finally { setBusy(null); }
  };

  return <div className="settings-page">
    <PageHeader title="AI 设置" description="使用你自己的 API Key；日志和复盘文件仍只保存在本机。"/>
    <section className="card settings-panel">
      <div className="section-heading"><div><h3>选择服务商</h3><p>支持 OpenAI、DeepSeek 和其他 OpenAI 兼容接口。</p></div>{hasApiKey && <span className="saved-key-badge">✓ 已安全保存</span>}</div>
      <div className="provider-grid">{(['openai', 'deepseek', 'custom'] as const).map((id) => <ProviderCard key={id} id={id} selected={form.providerId === id} onSelect={() => updateProvider(id)}/>)}</div>
      <div className="settings-fields">
        {form.providerId === 'custom' && <Field label="API 地址"><input aria-label="API 地址" value={form.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}/><small>必须使用 HTTPS；开发环境仅允许 localhost HTTP。</small></Field>}
        <Field label="模型"><input aria-label="模型" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })}/></Field>
        <Field label="API Key"><input aria-label="API Key" type="password" value={form.apiKey ?? ''} placeholder={hasApiKey ? '留空即保留当前 Key' : '输入你的 API Key'} autoComplete="new-password" onChange={(event) => setForm({ ...form, apiKey: event.target.value || undefined })}/><small>Key 由 Windows 安全存储加密，界面不会再次显示原值。</small></Field>
      </div>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">操作失败：{error}</StatusBanner>}
      <div className="settings-actions"><Button loading={busy === 'test'} onClick={() => void run('test')}>测试连接</Button><Button variant="primary" loading={busy === 'save'} onClick={() => void run('save')}>保存设置</Button></div>
    </section>
  </div>;
}
