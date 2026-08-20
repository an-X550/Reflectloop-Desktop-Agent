import { useEffect, useState } from 'react';
import type { JournalTemplate } from '../../shared/schemas/domain';
import type { SaveProviderConfigInput } from '../../shared/schemas/ipc';
import { Button } from '../components/button';
import { ConfirmDialog } from '../components/confirm-dialog';
import { Field } from '../components/field';
import { Modal } from '../components/modal';
import { PageHeader } from '../components/page-header';
import { StatusBanner } from '../components/status-banner';
import { ProviderCard } from '../features/settings/provider-card';
import { applyThemePreference, getThemePreference, type ThemePreference } from '../utils/theme';

const presets = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
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
  const [confirmClearKey, setConfirmClearKey] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference());
  const changeTheme = (next: ThemePreference) => { setTheme(next); applyThemePreference(next); };
  const [templates, setTemplates] = useState<JournalTemplate[]>([]);
  const [editingTpl, setEditingTpl] = useState<{ name: string; body: string; original?: string } | null>(null);
  const [tplMessage, setTplMessage] = useState('');
  const [confirmDeleteTpl, setConfirmDeleteTpl] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [confirmChangeLocation, setConfirmChangeLocation] = useState<{ target: string; move: boolean } | null>(null);
  const [appInfo, setAppInfo] = useState<{ version: string; updateUrl: string | null } | null>(null);
  const [updateUrlInput, setUpdateUrlInput] = useState('');
  const refreshTemplates = () => { void window.zhiji.templates.list().then(setTemplates).catch(() => undefined); };
  useEffect(() => { refreshTemplates(); void window.zhiji.app.getInfo().then((info) => { setAppInfo(info); setUpdateUrlInput(info.updateUrl ?? ''); }); }, []);

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
      } else {
        await window.zhiji.settings.testConnection(form);
        const result = await window.zhiji.settings.save(form);
        setHasApiKey(result.hasApiKey);
        await onSaved?.();
      }
      setForm((current) => ({ providerId: current.providerId, baseUrl: current.baseUrl, model: current.model }));
      setMessage(kind === 'save' ? '设置已安全保存' : '连接成功，设置已安全保存');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '请检查配置后重试'); }
    finally { setBusy(null); }
  };
  const clearApiKey = async () => {
    setBusy('save'); setMessage(''); setError('');
    try { const result = await window.zhiji.settings.clearApiKey(); setHasApiKey(result.hasApiKey); await onSaved?.(); setMessage('已移除当前服务商的 API Key'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '移除失败'); }
    finally { setBusy(null); }
  };
  const exportBackup = async () => { setTransferBusy('export'); setTransferMessage(''); try { const result = await window.zhiji.transfer.exportBackup(); if (!result.canceled) setTransferMessage(`备份已导出，共 ${result.fileCount} 个文件。`); } catch (reason) { setTransferMessage(`导出失败：${reason instanceof Error ? reason.message : '请重试'}`); } finally { setTransferBusy(null); } };
  const previewBackup = async () => { setTransferBusy('preview'); setTransferMessage(''); try { const result = await window.zhiji.transfer.previewRestore(); if (!result.canceled) setRestorePreview(result); } catch (reason) { setTransferMessage(`校验失败：${reason instanceof Error ? reason.message : '备份不可用'}`); } finally { setTransferBusy(null); } };
  const restoreBackup = async () => { if (!restorePreview?.previewId) return; setTransferBusy('restore'); try { const result = await window.zhiji.transfer.restore(restorePreview.previewId); setRestorePreview(null); setTransferMessage(`恢复完成，共写入 ${result.fileCount} 个文件。请重启知己读取数据。`); } catch (reason) { setTransferMessage(`恢复失败：${reason instanceof Error ? reason.message : '请重试'}`); } finally { setTransferBusy(null); } };

  return <div className="settings-page">
    <PageHeader title="设置" description="管理外观、AI 服务、本地数据和你主动提供的个人背景。"/>
    <section className="card settings-panel">
      <div className="section-heading"><div><h3>外观</h3><p>选择浅色或深色界面；跟随系统时随 Windows 设置自动切换。</p></div></div>
      <div className="page-tabs" role="group" aria-label="外观主题">
        {([['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']] as const).map(([value, label]) => <button key={value} className={theme === value ? 'is-active' : ''} aria-pressed={theme === value} onClick={() => changeTheme(value)}>{label}</button>)}
      </div>
    </section>
    <section className="card settings-panel">
      <div className="section-heading"><div><h3>AI 服务</h3><p>选择服务商。支持 OpenAI、DeepSeek 和其他 OpenAI 兼容接口。</p></div>{hasApiKey && <span className="saved-key-badge">✓ 已安全保存</span>}</div>
      <div className="provider-grid">{(['openai', 'deepseek', 'custom'] as const).map((id) => <ProviderCard key={id} id={id} selected={form.providerId === id} onSelect={() => updateProvider(id)}/>)}</div>
      <div className="settings-fields">
        {form.providerId === 'custom' && <Field label="API 地址"><input aria-label="API 地址" value={form.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}/><small>必须使用 HTTPS；开发环境仅允许 localhost HTTP。</small></Field>}
        <Field label="模型"><input aria-label="模型" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })}/></Field>
        <Field label="API Key"><input aria-label="API Key" type="password" value={form.apiKey ?? ''} placeholder={hasApiKey ? '留空即保留当前 Key' : '输入你的 API Key'} autoComplete="new-password" onChange={(event) => setForm({ ...form, apiKey: event.target.value || undefined })}/><small>Key 由 Windows 安全存储加密，界面不会再次显示原值。</small></Field>
      </div>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">操作失败：{error}</StatusBanner>}
      <div className="settings-actions">{hasApiKey && <Button variant="danger" onClick={() => setConfirmClearKey(true)}>移除已保存 Key</Button>}<Button loading={busy === 'test'} onClick={() => void run('test')}>测试连接</Button><Button variant="primary" loading={busy === 'save'} onClick={() => void run('save')}>保存设置</Button></div>
      <ConfirmDialog open={confirmClearKey} title="移除已保存的 API Key？" description="移除后需要重新输入才能使用 AI 功能；其他设置保持不变。" confirmLabel="确认移除" onCancel={() => setConfirmClearKey(false)} onConfirm={() => { setConfirmClearKey(false); void clearApiKey(); }}/>
    </section>
    <section className="card transfer-panel">
      <div className="section-heading"><div><h3>本地数据</h3><p>管理数据存储位置、导出备份与恢复。更改位置后需要重启应用生效。</p></div></div>
      {dataInfo && <div className="data-location"><strong>{dataInfo.path}</strong><span>{dataInfo.writable ? '可写入' : '当前不可写'} · {dataInfo.fileCount} 个文件</span><Button onClick={() => void window.zhiji.dataDirectory.open()}>打开文件夹</Button></div>}
      <div className="transfer-actions"><Button loading={locationBusy} onClick={async () => { const result = await window.zhiji.dataDirectory.pickFolder(); if (result.canceled) return; setConfirmChangeLocation({ target: result.path, move: true }); }}>更改存储位置</Button></div>
      {locationMessage && <StatusBanner tone={locationMessage.includes('失败') ? 'error' : 'success'}>{locationMessage}</StatusBanner>}
      <div className="transfer-actions"><Button loading={transferBusy === 'export'} onClick={() => void exportBackup()}>导出可验证备份</Button><Button loading={transferBusy === 'preview'} onClick={() => void previewBackup()}>选择备份并校验</Button></div>
      {restorePreview?.previewId && <div className="restore-preview"><strong>备份校验通过：{restorePreview.fileCount} 个文件</strong><p>{restorePreview.categories?.journals ?? 0} 篇日志 · {restorePreview.categories?.reviews ?? 0} 份复盘 · {restorePreview.categories?.projects ?? 0} 个项目</p><p className="muted">为避免覆盖，恢复只允许写入空数据目录。</p><Button variant="primary" loading={transferBusy === 'restore'} onClick={() => void restoreBackup()}>确认恢复</Button></div>}
      {transferMessage && <StatusBanner tone={transferMessage.includes('失败') ? 'error' : 'success'}>{transferMessage}</StatusBanner>}
      <ConfirmDialog open={confirmChangeLocation !== null} title="更改数据存储位置？" description={confirmChangeLocation ? `将把数据位置更改为：${confirmChangeLocation.target}${confirmChangeLocation.move ? '（现有数据会被复制到新位置）' : '（不迁移现有数据）'}。更改后需要重启应用生效。` : ''} confirmLabel="确认更改" onCancel={() => setConfirmChangeLocation(null)} onConfirm={async () => { if (!confirmChangeLocation) return; const { target, move } = confirmChangeLocation; setLocationBusy(true); setLocationMessage(''); try { const result = await window.zhiji.dataDirectory.changeLocation({ target, move }); setConfirmChangeLocation(null); setLocationMessage(`已${result.moved ? '迁移数据并' : ''}更改位置到 ${result.to}，请重启应用生效。`); } catch (reason) { setLocationMessage(`更改失败：${reason instanceof Error ? reason.message : '请稍后重试'}`); } finally { setLocationBusy(false); } }}/>
    </section>
    <section className="card transfer-panel">
      <div className="section-heading"><div><h3>个人背景</h3><p>保存在 {dataInfo ? `${dataInfo.path}\\profile\\about-me.md` : '本地数据目录'}；不会从日志自动生成。</p></div></div>
      <Field label="个人背景"><textarea aria-label="个人背景" value={profile.body} onChange={(event) => setProfile({ ...profile, body: event.target.value })}/></Field>
      <label className="profile-toggle"><input type="checkbox" checked={profile.enabledForAi} onChange={(event) => setProfile({ ...profile, enabledForAi: event.target.checked })}/>允许 AI 在复盘和方向校准中使用</label>
      <div className="settings-actions"><Button variant="danger" disabled={!profile.body} onClick={() => void window.zhiji.profile.clear().then(() => { setProfile({ body: '', enabledForAi: false }); setProfileMessage('个人背景已清空'); })}>清空个人背景</Button><Button variant="primary" disabled={!profile.body.trim()} onClick={() => void window.zhiji.profile.save({ body: profile.body, enabledForAi: profile.enabledForAi }).then(() => setProfileMessage('个人背景已保存'))}>保存个人背景</Button></div>
      {profileMessage && <StatusBanner tone="success">{profileMessage}</StatusBanner>}
    </section>
    <section className="card transfer-panel">
      <div className="section-heading"><div><h3>日志模板</h3><p>在写日志时一键插入预设结构；模板存放在本地数据目录的 templates 文件夹。</p></div><Button variant="secondary" onClick={() => setEditingTpl({ name: '', body: '' })}>新建模板</Button></div>
      {templates.length === 0 ? <p className="muted">还没有模板。新建一个常用结构（如「每日回顾」「事件记录」），写日志时可直接套用。</p> : <ul className="template-index">
        {templates.map((tpl) => <li key={tpl.name}><button onClick={() => setEditingTpl({ name: tpl.name, body: tpl.body, original: tpl.name })}>{tpl.name}</button><span className="muted">{tpl.body.slice(0, 60)}{tpl.body.length > 60 ? '…' : ''}</span><div className="button-row" style={{ marginTop: 8 }}><Button variant="ghost" onClick={() => setConfirmDeleteTpl(tpl.name)}>删除</Button></div></li>)}
      </ul>}
      {tplMessage && <StatusBanner tone="success">{tplMessage}</StatusBanner>}
    </section>
    <section className="card transfer-panel">
      <div className="section-heading"><div><h3>关于</h3><p>当前版本与更新检查。</p></div></div>
      <div className="data-location"><strong>版本 {appInfo?.version ?? '—'}</strong><span>本地优先的 AI 日志复盘客户端</span></div>
      <Field label="发布地址（可选）"><input aria-label="发布地址" value={updateUrlInput} placeholder="https://your-release-page.example.com" onChange={(event) => setUpdateUrlInput(event.target.value)}/><small>设置后「检查更新」会在浏览器打开此地址，方便获取最新安装包。</small></Field>
      <div className="settings-actions"><Button variant="ghost" onClick={() => void window.zhiji.app.setUpdateUrl(updateUrlInput.trim() || null).then(() => setTplMessage('发布地址已保存'))}>保存地址</Button><Button variant="primary" disabled={!appInfo?.updateUrl} onClick={() => { if (appInfo?.updateUrl) window.open(appInfo.updateUrl, '_blank'); }}>检查更新</Button></div>
      {tplMessage && <StatusBanner tone="success">{tplMessage}</StatusBanner>}
    </section>
    <Modal open={editingTpl !== null} title={editingTpl?.original ? '编辑模板' : '新建模板'} onClose={() => setEditingTpl(null)}>
      <div>
        <Field label="模板名称"><input autoFocus aria-label="模板名称" value={editingTpl?.name ?? ''} maxLength={40} onChange={(event) => setEditingTpl((old) => old ? { ...old, name: event.target.value } : old)} placeholder="例如：每日回顾"/></Field>
        <Field label="模板正文"><textarea aria-label="模板正文" value={editingTpl?.body ?? ''} onChange={(event) => setEditingTpl((old) => old ? { ...old, body: event.target.value } : old)} placeholder="今天发生了什么？&#10;我做了什么？&#10;结果怎样？" style={{ minHeight: 180 }}/></Field>
        <div className="button-row"><Button variant="ghost" onClick={() => setEditingTpl(null)}>取消</Button><Button variant="primary" disabled={!editingTpl?.name.trim() || !editingTpl?.body.trim()} onClick={() => { const t = editingTpl; if (!t) return; void window.zhiji.templates.save({ name: t.name.trim(), body: t.body }).then(() => { setEditingTpl(null); refreshTemplates(); setTplMessage(t.original ? '模板已更新' : '模板已创建'); }); }}>保存模板</Button></div>
      </div>
    </Modal>
    <ConfirmDialog open={confirmDeleteTpl !== null} title="删除这个模板？" description={`「${confirmDeleteTpl ?? ''}」将被删除，已有日志不受影响。`} confirmLabel="确认删除" onCancel={() => setConfirmDeleteTpl(null)} onConfirm={() => { const name = confirmDeleteTpl; if (!name) return; void window.zhiji.templates.delete(name).then(() => { setConfirmDeleteTpl(null); refreshTemplates(); setTplMessage('模板已删除'); }); }}/>
  </div>;
}
