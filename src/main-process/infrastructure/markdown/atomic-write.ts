import crypto from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function atomicWriteUtf8(
  target: string,
  content: string,
  validate: (value: string) => void,
): Promise<void> {
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  const backup = `${target}.${crypto.randomUUID()}.bak`;
  await mkdir(path.dirname(target), { recursive: true });
  let backedUp = false;
  try {
    await writeFile(temp, content, 'utf8');
    const reread = await readFile(temp, 'utf8');
    validate(reread);
    try { await access(target); await rename(target, backup); backedUp = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await rename(temp, target);
    if (backedUp) await rm(backup, { force: true });
  } catch (error) {
    if (backedUp) { await rm(target, { force: true }); await rename(backup, target); }
    throw error;
  } finally {
    await rm(temp, { force: true });
    await rm(backup, { force: true });
  }
}
