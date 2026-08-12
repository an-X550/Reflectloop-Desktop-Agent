import { describe, expect, it } from 'vitest';
import { createWindowOptions } from '../../src/main-process/window-options';

describe('createWindowOptions', () => {
  it('isolates the renderer and enables sandboxing', () => {
    const options = createWindowOptions('D:/app/preload.js');
    expect(options.webPreferences).toMatchObject({
      preload: 'D:/app/preload.js',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    });
  });
});
