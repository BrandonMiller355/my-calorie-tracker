import type { Totals } from '../lib/totals';
import type { Goals } from '../types';

const METRICS = [
  { key: 'calories', label: 'Calorie burn', unit: 'kcal' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'protein', label: 'Protein', unit: 'g' },
] as const;

export function Summary({
  totals,
  goals,
  goalsAreDefault,
}: {
  totals: Totals;
  goals: Goals;
  goalsAreDefault: boolean;
}) {
  return (
    <section className="summary" aria-label="Daily summary">
      {METRICS.map(({ key, label, unit }) => {
        const consumed = totals[key];
        const goal = goals[key];
        const remaining = Math.round((goal - consumed) * 10) / 10;
        const over = remaining < 0;
        return (
          <div key={key} className={`summary-card${over ? ' over' : ''}`}>
            <div className="summary-label">{label}</div>
            <div className="summary-consumed">
              {consumed} <span className="summary-unit">/ {goal} {unit}</span>
            </div>
            <div className="summary-remaining">
              {over ? `Over by ${Math.abs(remaining)} ${unit}` : `${remaining} ${unit} left`}
            </div>
          </div>
        );
      })}
      {goalsAreDefault && (
        <p className="summary-note">Using default goals — set your own in Settings.</p>
      )}
    </section>
  );
}
