import { entryTotals } from '../lib/totals';
import { unitLabel } from '../lib/units';
import { MEAL_LABELS, type FoodEntry, type Meal } from '../types';

export function MealSection({
  meal,
  entries,
  onAdd,
  onEdit,
  onDelete,
  open = true,
  onToggle,
  isNow = false,
}: {
  meal: Meal;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
  /** Collapsed sections hide their entries and add button (CSS-only) */
  open?: boolean;
  onToggle?: () => void;
  /** The meal the current time falls in gets the NOW chip and active card look */
  isNow?: boolean;
}) {
  const subtotal = Math.round(entries.reduce((sum, e) => sum + entryTotals(e).calories, 0));

  return (
    <section
      className={`meal-section${open ? ' meal-open' : ''}${isNow ? ' meal-now' : ''}`}
      aria-label={MEAL_LABELS[meal]}
    >
      <header className="meal-header">
        <h2 className="meal-title">
          <button
            type="button"
            className="meal-toggle"
            aria-expanded={open}
            onClick={onToggle}
          >
            {MEAL_LABELS[meal]}
          </button>
        </h2>
        {isNow && <span className="meal-now-chip">Now</span>}
        <span className="meal-count" aria-hidden="true">
          {entries.length === 1 ? '1 item' : `${entries.length} items`}
        </span>
        <span className="meal-subtotal">{subtotal} kcal</span>
        <span className="meal-chevron" aria-hidden="true">
          ›
        </span>
      </header>
      <div className="meal-body">
        {entries.length === 0 ? (
          <p className="meal-empty">Nothing logged yet.</p>
        ) : (
          <ul className="entry-list">
            {entries.map((entry) => {
              const t = entryTotals(entry);
              const showQty = !(entry.amount === 1 && entry.unit === entry.servingLabel);
              return (
                <li key={entry.id} className="entry-row">
                  <button className="entry-main" onClick={() => onEdit(entry)}>
                    <span className="entry-name">{entry.name}</span>
                    <span className="entry-caption">
                      {entry.source === 'quick'
                        ? entry.description && (
                            <span className="entry-qty">{entry.description} · </span>
                          )
                        : showQty && (
                            <span className="entry-qty">
                              {entry.amount} {unitLabel(entry.unit)} ·{' '}
                            </span>
                          )}
                      F {t.fat} · C {t.carbs} · P {t.protein}
                    </span>
                  </button>
                  <span className="entry-cal">{t.calories}</span>
                  <button
                    className="entry-delete"
                    aria-label={`Delete ${entry.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete ${entry.name}?`)) {
                        onDelete(entry.id);
                      }
                    }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button className="meal-add" onClick={onAdd}>
          + Log food
        </button>
      </div>
    </section>
  );
}
