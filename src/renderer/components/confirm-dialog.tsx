import { Button } from './button';
import { Modal } from './modal';

/**
 * 统一的危险操作确认弹窗：替代 window.confirm 与内联确认块。
 * 只有用户显式点击确认按钮才执行操作。
 */
export function ConfirmDialog({ open, title, description, confirmLabel = '确认', loading = false, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  return <Modal open={open} title={title} onClose={onCancel}>
    <div className="confirm-dialog">
      <p>{description}</p>
      <div className="button-row">
        <Button variant="ghost" onClick={onCancel}>取消</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </Modal>;
}
