import type { HistoryItem } from '../../domain/history-items';
const labels = { journal: '日志', daily: '日反馈', weekly: '周报', monthly: '月报', project: '项目复盘' };
export function HistoryReader({ item }: { item: HistoryItem }) { return <article className="card history-reader"><div className="reader-meta"><span className="tag">{labels[item.kind]}</span><time>{item.date}</time></div><h2>{item.title}</h2><pre>{item.body}</pre>{item.sourceIds.length > 0 && <footer><strong>材料来源</strong><p>{item.sourceIds.join('、')}</p></footer>}</article>; }
