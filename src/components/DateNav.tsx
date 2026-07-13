import { addDays, formatDateKey, todayKey } from '../lib/date';

export function DateNav({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const isToday = date === todayKey();
  return (
    <div className="date-nav">
      <button
        className="date-arrow"
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
      >
        ‹
      </button>
      <div className="date-nav-center">
        <span className="date-label">{isToday ? 'Today' : formatDateKey(date)}</span>
        <span className="date-caption" aria-hidden="true">
          {isToday ? formatDateKey(date) : 'Tap to pick a date'}
        </span>
        <input
          type="date"
          aria-label="Pick a date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </div>
      <button className="date-arrow" aria-label="Next day" onClick={() => onChange(addDays(date, 1))}>
        ›
      </button>
      {!isToday && (
        <button className="today-btn" onClick={() => onChange(todayKey())}>
          Today
        </button>
      )}
    </div>
  );
}
