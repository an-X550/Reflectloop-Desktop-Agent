import { HISTORY_KIND_LABELS, type HistoryItem } from '../../domain/history-items';
import { MarkdownDocument } from '../../components/markdown-document';

export function HistoryReader({ item, onEdit, onGenerateDaily, onDelete }: { item: HistoryItem; onEdit?(id: string): void; onGenerateDaily?(date: string): void; onDelete?(item: HistoryItem): void }) {
  return <article className="card history-reader">
    <div className="reader-meta">
      <span className="tag">{HISTORY_KIND_LABELS[item.kind]}</span>
      <time>{item.date}</time>
      <span className="reader-actions">
        {item.kind === 'journal' && onGenerateDaily && <button onClick={() => onGenerateDaily(item.date)}>生成这一天的反馈</button>}
        {item.kind === 'journal' && onEdit && <button onClick={() => onEdit(item.id)}>编辑</button>}
        {onDelete && <button onClick={() => onDelete(item)}>移到回收站</button>}
      </span>
    </div>
    <h2>{item.title}</h2>
    <MarkdownDocument>{item.body}</MarkdownDocument>
    {item.sourceIds.length > 0 && <footer><strong>材料来源</strong><p>{item.sourceIds.join('、')}</p></footer>}
  </article>;
}
