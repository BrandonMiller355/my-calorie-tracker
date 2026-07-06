/** Format a Date as a local-timezone YYYY-MM-DD key. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Add whole days to a YYYY-MM-DD key, staying in local time. */
export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta, 12); // noon avoids DST edge cases
  return toDateKey(date);
}

/** Monday on/before the given date key, staying in local time. */
export function startOfWeek(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const day = new Date(y, m - 1, d, 12).getDay(); // 0 (Sun) - 6 (Sat)
  const deltaToMonday = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, deltaToMonday);
}

/** Human-friendly label for a date key, e.g. "Fri, Jul 4". */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
