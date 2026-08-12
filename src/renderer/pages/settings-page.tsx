import { useEffect, useState } from 'react';
import { PROVIDER_PRESETS } from '../../main-process/infrastructure/ai/provider-config';
import type { SaveProviderConfigInput } from '../../shared/schemas/ipc';

export function SettingsPage() {
  const [form, setForm] = useState<SaveProviderConfigInput>({ providerId: 'openai', baseUrl: PROVIDER_PRESETS.openai.baseUrl, model: PROVIDER_PRESETS.openai.defaultModel });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { void window.zhiji.settings.getPublicConfig().then(({ hasApiKey: saved, ...config }) => { setForm(config); setHasApiKey(saved); }); }, []);
  const updateProvider = (providerId: SaveProviderConfigInput['providerId']) => {
    const preset = providerId === 'custom' ? null : PROVIDER_PRESETS[providerId];
    setForm((old) => ({ ...old, providerId, ...(preset ? { baseUrl: preset.baseUrl, model: preset.defaultModel } : {}) }));
  };
  const run = async (kind: 'save' | 'test') => {
    setMessage(kind === 'save' ? '正在保存…' : '正在测试连接…');
    try {
      if (kind === 'save') { const result = await window.zhiji.settings.save(form); setHasApiKey(result.hasApiKey); }
      else await window.zhiji.settings.testConnection(form);
      setForm(({ apiKey: _discard, ...rest }) => rest);
      setMessage(kind === 'save' ? '设置已安全保存' : '连接成功');
    } catch (error) { setMessage(`操作失败：${error instanceof Error ? error.message : '请检查配置'}`); }
  };
  return <><header><div><h2>设置</h2><p>使用你自己的 OpenAI 兼容接口，Key 由 Windows 安全存储保护。</p></div></header><section className="card settings-form">
    <label>服务商</label><select value={form.providerId} onChange={(event) => updateProvider(event.target.value as SaveProviderConfigInput['providerId'])}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="custom">自定义兼容接口</option></select>
    <label>API 地址</label><input value={form.baseUrl} disabled={form.providerId !== 'custom'} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}/>
    <label>模型</label><input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })}/>
    <label>API Key {hasApiKey && <small>（已保存，留空即保持不变）</small>}</label><input type="password" value={form.apiKey ?? ''} autoComplete="off" onChange={(event) => setForm({ ...form, apiKey: event.target.value || undefined })}/>
    <div className="actions"><span>{message}</span><button onClick={() => void run('test')}>测试连接</button><button className="primary" onClick={() => void run('save')}>保存设置</button></div>
  </section></>;
}
