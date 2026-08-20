import { z } from 'zod';
import { appError } from '../../../shared/errors/app-error';

export const ArchiveFileSchema = z.object({ path: z.string().min(1).max(512), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().nonnegative() }).strict();
export const ArchiveManifestSchema = z.object({ formatVersion: z.literal(1), exportedAt: z.string().datetime(), appVersion: z.string().min(1).max(64), files: z.array(ArchiveFileSchema).max(100_000) }).strict();
export type ArchiveManifest = z.infer<typeof ArchiveManifestSchema>;

const roots = ['journals/', 'reviews/', 'projects/', 'profile/'];
export function isPortablePath(value: string): boolean {
  if (value === 'settings.json') return true;
  if (value.startsWith('profile/')) return value === 'profile/about-me.md';
  if (value.startsWith('agent/sessions/')) {
    const parts = value.split('/');
    return parts.length === 5 && parts[0] === 'agent' && parts[1] === 'sessions' && parts[2].length > 0 && parts[3].length > 0 && parts[4] === 'session.jsonl' && !value.includes('\\') && !value.startsWith('/') && !parts.includes('..');
  }
  return roots.some((root) => value.startsWith(root)) && !value.includes('\\') && !value.split('/').includes('..') && !value.startsWith('/');
}

export function assertPortablePath(value: string): void {
  if (!isPortablePath(value)) throw appError({ code: 'IMPORT_REJECTED', reason: `压缩包包含不允许的路径：${value}` });
  const normalized = value.replaceAll('\\', '/');
  if (normalized !== value || normalized.includes('//') || normalized.endsWith('/')) throw appError({ code: 'IMPORT_REJECTED', reason: `压缩包路径无效：${value}` });
}
