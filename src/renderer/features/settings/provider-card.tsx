import type { SaveProviderConfigInput } from '../../../shared/schemas/ipc';

const details = {
  openai: { name: 'OpenAI', description: '官方接口，默认使用 GPT-5 mini' },
  deepseek: { name: 'DeepSeek', description: '兼容 OpenAI 协议的国内服务' },
  custom: { name: '自定义', description: '接入任意 OpenAI 兼容接口' },
} as const;

export function ProviderCard({ id, selected, onSelect }: { id: SaveProviderConfigInput['providerId']; selected: boolean; onSelect(): void }) {
  const item = details[id];
  return <button type="button" className={`provider-card ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={onSelect}>
    <span className="provider-card__mark">{item.name.slice(0, 1)}</span>
    <span><strong>{item.name}</strong><small>{item.description}</small></span>
    <span className="provider-card__check" aria-hidden="true">✓</span>
  </button>;
}
