import { useState } from 'react';
import type { JournalTemplate } from '../../../shared/schemas/domain';
import { Button } from '../../components/button';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { Field } from '../../components/field';
import { Modal } from '../../components/modal';
import { StatusBanner } from '../../components/status-banner';

type EditingTemplate = { name: string; body: string; original?: string };

export function TemplateManager({ open, templates, onClose, onChanged }: { open: boolean; templates: JournalTemplate[]; onClose(): void; onChanged(templates: JournalTemplate[]): void }) {
  const [editing, setEditing] = useState<EditingTemplate | null>(null);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => { onChanged(await window.zhiji.templates.list()); };
  const save = async () => {
    if (!editing?.name.trim() || !editing.body.trim()) return;
    setBusy(true); setMessage(''); setError('');
    try {
      await window.zhiji.templates.save({ name: editing.name.trim(), body: editing.body });
      await refresh(); setEditing(null); setMessage(editing.original ? '模板已更新' : '模板已创建');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存模板失败，请稍后重试'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleteName) return;
    setBusy(true); setMessage(''); setError('');
    try { await window.zhiji.templates.delete(deleteName); await refresh(); setDeleteName(null); setMessage('模板已删除'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '删除模板失败，请稍后重试'); }
    finally { setBusy(false); }
  };

  return <>
    <Modal open={open} title="管理日志模板" onClose={onClose}>
      <div className="template-manager">
        <div className="section-heading"><div><h3>写日志时快速插入</h3><p>模板只保存在本机，用来减少每次开始记录时的空白感。</p></div><Button variant="secondary" onClick={() => { setEditing({ name: '', body: '' }); setMessage(''); setError(''); }}>新建模板</Button></div>
        {message && <StatusBanner tone="success">{message}</StatusBanner>}
        {error && <StatusBanner tone="error">操作失败：{error}</StatusBanner>}
        {editing && <div className="template-editor">
          <Field label="模板名称"><input autoFocus aria-label="模板名称" value={editing.name} maxLength={40} onChange={(event) => setEditing((old) => old ? { ...old, name: event.target.value } : old)} placeholder="例如：每日回顾"/></Field>
          <Field label="模板正文"><textarea aria-label="模板正文" value={editing.body} onChange={(event) => setEditing((old) => old ? { ...old, body: event.target.value } : old)} placeholder="今天发生了什么？\n我做了什么？\n结果怎样？"/></Field>
          <div className="button-row"><Button variant="ghost" onClick={() => setEditing(null)}>取消编辑</Button><Button variant="primary" loading={busy} disabled={!editing.name.trim() || !editing.body.trim()} onClick={() => void save()}>保存模板</Button></div>
        </div>}
        {templates.length === 0 ? <p className="muted">还没有模板。新建一个常用结构后，写日志时即可直接套用。</p> : <ul className="template-index">{templates.map((template) => <li key={template.name}><div><button type="button" onClick={() => setEditing({ name: template.name, body: template.body, original: template.name })}>{template.name}</button><span className="muted">{template.body.slice(0, 80)}{template.body.length > 80 ? '…' : ''}</span></div><Button variant="ghost" onClick={() => setDeleteName(template.name)}>删除</Button></li>)}</ul>}
      </div>
    </Modal>
    <ConfirmDialog open={deleteName !== null} title="删除这个模板？" description={`「${deleteName ?? ''}」将被删除，已有日志不受影响。`} confirmLabel="确认删除" loading={busy} onCancel={() => setDeleteName(null)} onConfirm={() => void remove()}/>
  </>;
}
