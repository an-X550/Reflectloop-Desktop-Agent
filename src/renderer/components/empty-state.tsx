import type { ReactNode } from 'react';
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-state__mark">◇</span><h3>{title}</h3><p>{description}</p>{action}</div>; }
