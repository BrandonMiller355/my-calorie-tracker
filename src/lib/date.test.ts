import { addDays, startOfWeek, toDateKey, todayKey } from './date';

describe('toDateKey', () => {
  it('formats local dates with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('uses local components, not UTC', () => {
    // 23:30 local on Jan 5 must stay Jan 5 regardless of timezone
    expect(toDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2026-07-04', 1)).toBe('2026-07-05');
    expect(addDays('2026-07-04', -1)).toBe('2026-07-03');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('startOfWeek', () => {
  it('returns the same date when given a Monday', () => {
    expect(startOfWeek('2026-07-06')).toBe('2026-07-06');
  });

  it('returns the prior Monday when given a Sunday', () => {
    expect(startOfWeek('2026-07-05')).toBe('2026-06-29');
  });

  it('returns the Monday of a mid-week date', () => {
    expect(startOfWeek('2026-07-08')).toBe('2026-07-06');
  });

  it('crosses a year boundary', () => {
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29');
  });
});

describe('todayKey', () => {
  it('matches toDateKey of now', () => {
    expect(todayKey()).toBe(toDateKey(new Date()));
  });
});
