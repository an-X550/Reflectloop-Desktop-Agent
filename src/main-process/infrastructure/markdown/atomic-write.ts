import crypto from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function atomicWriteUtf8(
  target: string,
  content: string,
  validate: (value: string) => void,
): Promise<void> {
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(temp, content, 'utf8');
    const reread = await readFile(temp, 'utf8');
    validate(reread);
    await rm(target, { force: true });
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}
