import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button({ variant = 'secondary', loading = false, children, className = '', disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; children: ReactNode }) {
  return <button className={`btn btn--${variant} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? '请稍候…' : children}</button>;
}
