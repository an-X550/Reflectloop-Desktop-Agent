import { describe, expect, it } from 'vitest';
import { getIsoWeekRange, getMonthRange } from '../../src/main-process/domain/date-periods';

describe('date periods', () => {
  it('handles ISO weeks across years', () => expect(getIsoWeekRange('2026-01-01')).toEqual({ start: '2025-12-29', end: '2026-01-04', key: '2026-W01' }));
  it('handles leap-year months', () => expect(getMonthRange('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29', key: '2028-02' }));
});
