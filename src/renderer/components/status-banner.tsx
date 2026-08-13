import { MarkdownDocument } from './markdown-document';

export function StatusBanner({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error' | 'warm'; children: React.ReactNode }) {
  const content = typeof children === 'string' && (/\r?\n/.test(children) || /^#{1,6}\s/.test(children)) ? <MarkdownDocument>{children}</MarkdownDocument> : children;
  return <div className={`status-banner status-banner--${tone}`} role="status" aria-live="polite">{content}</div>;
}
