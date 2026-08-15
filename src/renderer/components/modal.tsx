import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  // 用 ref 保存 onClose，避免内联箭头函数引用变化导致 effect 每次渲染都重跑（进而抢焦点）。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', key);
    // 只聚焦输入类控件（input/textarea/select），不碰按钮——否则会命中 header 的关闭键。
    queueMicrotask(() => dialog.current?.querySelector<HTMLElement>('input, textarea, select')?.focus());
    return () => document.removeEventListener('keydown', key);
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialog}>
        <div className="modal__header">
          <h2 id="modal-title">{title}</h2>
          <button aria-label="关闭" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
