import { describe, expect, it } from 'vitest';
import { buildEvidencePackets, estimateTokens } from '../../src/main-process/domain/token-budget';

describe('evidence budget', () => {
  it('keeps source attribution while splitting material', () => {
    expect(estimateTokens('一二三四五')).toBe(3);
    const packets = buildEvidencePackets([{ id: 'journal_a1', date: '2026-08-01', body: '甲'.repeat(30) }], 10);
    expect(packets.length).toBeGreaterThan(1);
    expect(packets.every((packet) => packet.sourceIds.includes('journal_a1'))).toBe(true);
  });
});
