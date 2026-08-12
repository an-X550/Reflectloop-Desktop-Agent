import { z } from 'zod';

export const ArchiveFileSchema = z.object({ path: z.string().min(1).max(512), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().nonnegative() }).strict();
export const ArchiveManifestSchema = z.object({ formatVersion: z.literal(1), exportedAt: z.string().datetime(), appVersion: z.string().min(1).max(64), files: z.array(ArchiveFileSchema).max(100_000) }).strict();
export type ArchiveManifest = z.infer<typeof ArchiveManifestSchema>;

const roots = ['journals/', 'reviews/', 'projects/'];
export function isPortablePath(value: string): boolean {
  if (value === 'settings.json') return true;
  return roots.some((root) => value.startsWith(root)) && !value.includes('\\') && !value.split('/').includes('..') && !value.startsWith('/');
}

export function assertPortablePath(value: string): void {
  if (!isPortablePath(value)) throw new Error(`压缩包包含不允许的路径：${value}`);
  const normalized = value.replaceAll('\\', '/');
  if (normalized !== value || normalized.includes('//') || normalized.endsWith('/')) throw new Error(`压缩包路径无效：${value}`);
}
