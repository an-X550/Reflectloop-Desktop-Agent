import crypto from 'node:crypto';

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_PREVIEWS = 50;

interface MaterialLike { id: string; updatedAt?: string; createdAt: string }

/**
 * 预览令牌存储：preview 时按材料摘要签发令牌，generate 时校验材料未变并一次性消费。
 * 周期复盘与洞察复盘共用同一实现；令牌仅存活于进程内，重启失效。
 */
export class PreviewTokenStore<TInput> {
  private readonly previews = new Map<string, { digest: string; input: TInput; createdAt: string }>();

  constructor(private readonly now: () => string) {}

  static digest(materials: MaterialLike[]): string {
    return crypto.createHash('sha256').update(materials.map((item) => `${item.id}:${item.updatedAt ?? item.createdAt}`).join('|')).digest('hex');
  }

  /** 签发令牌并返回材料摘要。 */
  issue(input: TInput, materials: MaterialLike[]): { token: string; digest: string } {
    const digest = PreviewTokenStore.digest(materials);
    const token = crypto.randomUUID();
    this.previews.set(token, { input, digest, createdAt: this.now() });
    this.prune();
    return { token, digest };
  }

  /** 读取有效令牌（过期或不存在返回 undefined）；不消费。 */
  peek(token: string): { digest: string; input: TInput } | undefined {
    this.prune();
    return this.previews.get(token);
  }

  /** 一次性消费令牌。 */
  consume(token: string): void {
    this.previews.delete(token);
  }

  private prune(): void {
    const horizon = new Date(this.now()).getTime() - PREVIEW_TTL_MS;
    for (const [token, preview] of this.previews) {
      if (new Date(preview.createdAt).getTime() < horizon) this.previews.delete(token);
    }
    while (this.previews.size > MAX_PREVIEWS) {
      const oldest = this.previews.keys().next();
      if (oldest.done) break;
      this.previews.delete(oldest.value);
    }
  }
}
