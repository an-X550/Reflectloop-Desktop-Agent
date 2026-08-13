import { describe, expect, it } from 'vitest';
import { toLocalDateString } from '../../src/renderer/utils/local-date';

describe('toLocalDateString', () => {
  it('uses local calendar fields instead of the UTC date', () => {
    const localMidnight = new Date(2026, 7, 14, 0, 30);
    expect(toLocalDateString(localMidnight)).toBe('2026-08-14');
  });
});
