import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CredentialStore } from '../../src/main-process/infrastructure/credentials/credential-store';

describe('CredentialStore', () => {
  it('persists only encrypted key material', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-key-'));
    const crypto = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(`encrypted:${value}`).subarray(0, 9),
      decryptString: () => 'test-secret-key',
    };
    const store = new CredentialStore(root, crypto);
    await store.save('openai', 'test-secret-key');
    expect(await store.read('openai')).toBe('test-secret-key');
    expect(await readFile(path.join(root, 'credentials.json'), 'utf8')).not.toContain('test-secret-key');
  });

  it('fails closed when OS encryption is unavailable', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-key-'));
    const store = new CredentialStore(root, { isEncryptionAvailable: () => false, encryptString: () => Buffer.alloc(0), decryptString: () => '' });
    await expect(store.save('openai', 'secret')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});
