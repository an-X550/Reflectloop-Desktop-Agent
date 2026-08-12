import type { ReactNode } from 'react';
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <div className="page-hero"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>; }
