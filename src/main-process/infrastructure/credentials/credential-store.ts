import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appError } from '../../../shared/errors/app-error';

export interface SafeStoragePort {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export class CredentialStore {
  private readonly target: string;
  constructor(root: string, private readonly encryption: SafeStoragePort) {
    this.target = path.join(root, 'credentials.json');
  }

  private async readAll(): Promise<Record<string, string>> {
    try { return JSON.parse(await readFile(this.target, 'utf8')) as Record<string, string>; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
  }

  async save(providerId: string, apiKey: string): Promise<void> {
    if (!this.encryption.isEncryptionAvailable()) throw appError({ code: 'UNKNOWN', message: 'Windows 安全存储当前不可用。' });
    const data = await this.readAll();
    data[providerId] = this.encryption.encryptString(apiKey).toString('base64');
    await mkdir(path.dirname(this.target), { recursive: true });
    await writeFile(this.target, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  }

  async read(providerId: string): Promise<string | null> {
    const encrypted = (await this.readAll())[providerId];
    if (!encrypted) return null;
    if (!this.encryption.isEncryptionAvailable()) throw appError({ code: 'UNKNOWN', message: 'Windows 安全存储当前不可用。' });
    return this.encryption.decryptString(Buffer.from(encrypted, 'base64'));
  }

  async delete(providerId: string): Promise<void> {
    const data = await this.readAll();
    delete data[providerId];
    if (Object.keys(data).length === 0) await rm(this.target, { force: true });
    else await writeFile(this.target, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  }
}
