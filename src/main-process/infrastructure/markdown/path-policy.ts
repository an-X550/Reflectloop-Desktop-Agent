import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { appError } from '../../../shared/errors/app-error';

export async function resolveInsideRoot(root: string, ...segments: string[]): Promise<string> {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw appError({ code: 'INVALID_INPUT', message: 'Path escapes data root.' });
  }
  let cursor = resolvedRoot;
  for (const segment of path.relative(resolvedRoot, target).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    try {
      if ((await lstat(cursor)).isSymbolicLink()) {
        throw appError({ code: 'INVALID_INPUT', message: 'Symbolic links are not allowed.' });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return target;
}
