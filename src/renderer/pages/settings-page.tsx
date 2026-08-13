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
  const [transferBusy, setTransferBusy] = useState<'export' | 'preview' | 'restore' | null>(null);
  const [transferMessage, setTransferMessage] = useState('');
  const [restorePreview, setRestorePreview] = useState<Awaited<ReturnType<Window['zhiji']['transfer']['previewRestore']>> | null>(null);
  const [dataInfo, setDataInfo] = useState<Awaited<ReturnType<Window['zhiji']['dataDirectory']['getInfo']>> | null>(null);
  const [profile, setProfile] = useState({ body: '', enabledForAi: false }); const [profileMessage, setProfileMessage] = useState('');

  useEffect(() => { void Promise.all([window.zhiji.settings.getPublicConfig(), window.zhiji.dataDirectory.getInfo(), window.zhiji.profile.get()]).then(([{ hasApiKey: saved, ...config }, info, savedProfile]) => { setForm(config); setHasApiKey(saved); setDataInfo(info); if (savedProfile) setProfile({ body: savedProfile.body, enabledForAi: savedProfile.enabledForAi }); }); }, []);
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
  const exportBackup = async () => { setTransferBusy('export'); setTransferMessage(''); try { const result = await window.zhiji.transfer.exportBackup(); if (!result.canceled) setTransferMessage(`备份已导出，共 ${result.fileCount} 个文件。`); } catch (reason) { setTransferMessage(`导出失败：${reason instanceof Error ? reason.message : '请重试'}`); } finally { setTransferBusy(null); } };
  const previewBackup = async () => { setTransferBusy('preview'); setTransferMessage(''); try { const result = await window.zhiji.transfer.previewRestore(); if (!result.canceled) setRestorePreview(result); } catch (reason) { setTransferMessage(`校验失败：${reason instanceof Error ? reason.message : '备份不可用'}`); } finally { setTransferBusy(null); } };
  const restoreBackup = async () => { if (!restorePreview?.previewId) return; setTransferBusy('restore'); try { const result = await window.zhiji.transfer.restore(restorePreview.previewId); setRestorePreview(null); setTransferMessage(`恢复完成，共写入 ${result.fileCount} 个文件。请重启知己读取数据。`); } catch (reason) { setTransferMessage(`恢复失败：${reason instanceof Error ? reason.message : '请重试'}`); } finally { setTransferBusy(null); } };

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
    <section className="card transfer-panel">
      <div className="section-heading"><div><h3>本地数据</h3><p>导出日志、复盘、项目与公开 AI 配置；API Key 和缓存不会进入备份。</p></div></div>
      {dataInfo && <div className="data-location"><strong>{dataInfo.path}</strong><span>{dataInfo.writable ? '可写入' : '当前不可写'} · {dataInfo.fileCount} 个文件</span><Button onClick={() => void window.zhiji.dataDirectory.open()}>打开数据文件夹</Button></div>}
      <div className="transfer-actions"><Button loading={transferBusy === 'export'} onClick={() => void exportBackup()}>导出可验证备份</Button><Button loading={transferBusy === 'preview'} onClick={() => void previewBackup()}>选择备份并校验</Button></div>
      {restorePreview?.previewId && <div className="restore-preview"><strong>备份校验通过：{restorePreview.fileCount} 个文件</strong><p>{restorePreview.categories?.journals ?? 0} 篇日志 · {restorePreview.categories?.reviews ?? 0} 份复盘 · {restorePreview.categories?.projects ?? 0} 个项目</p><p className="muted">为避免覆盖，恢复只允许写入空数据目录。</p><Button variant="primary" loading={transferBusy === 'restore'} onClick={() => void restoreBackup()}>确认恢复</Button></div>}
      {transferMessage && <StatusBanner tone={transferMessage.includes('失败') ? 'error' : 'success'}>{transferMessage}</StatusBanner>}
    </section>
    <section className="card transfer-panel">
      <div className="section-heading"><div><h3>个人背景</h3><p>保存在 {dataInfo ? `${dataInfo.path}\\profile\\about-me.md` : '本地数据目录'}；不会从日志自动生成。</p></div></div>
      <Field label="个人背景"><textarea aria-label="个人背景" value={profile.body} onChange={(event) => setProfile({ ...profile, body: event.target.value })}/></Field>
      <label className="profile-toggle"><input type="checkbox" checked={profile.enabledForAi} onChange={(event) => setProfile({ ...profile, enabledForAi: event.target.checked })}/>允许 AI 使用（当前版本只保存选择，暂不注入分析）</label>
      <div className="settings-actions"><Button variant="danger" disabled={!profile.body} onClick={() => void window.zhiji.profile.clear().then(() => { setProfile({ body: '', enabledForAi: false }); setProfileMessage('个人背景已清空'); })}>清空个人背景</Button><Button variant="primary" disabled={!profile.body.trim()} onClick={() => void window.zhiji.profile.save({ body: profile.body, enabledForAi: profile.enabledForAi }).then(() => setProfileMessage('个人背景已保存'))}>保存个人背景</Button></div>
      {profileMessage && <StatusBanner tone="success">{profileMessage}</StatusBanner>}
    </section>
  </div>;
}
