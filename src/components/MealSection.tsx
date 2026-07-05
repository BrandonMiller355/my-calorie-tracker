import { entryTotals } from '../lib/totals';
import { MEAL_LABELS, type FoodEntry, type Meal } from '../types';

export function MealSection({
  meal,
  entries,
  onAdd,
  onEdit,
  onDelete,
}: {
  meal: Meal;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const subtotal = Math.round(entries.reduce((sum, e) => sum + entryTotals(e).calories, 0));

  return (
    <section className="meal-section" aria-label={MEAL_LABELS[meal]}>
      <header className="meal-header">
        <h2>{MEAL_LABELS[meal]}</h2>
        <span className="meal-subtotal">{subtotal} kcal</span>
      </header>
      {entries.length === 0 ? (
        <p className="meal-empty">Nothing logged yet.</p>
      ) : (
        <ul className="entry-list">
          {entries.map((entry) => {
            const t = entryTotals(entry);
            return (
              <li key={entry.id} className="entry-row">
                <button className="entry-main" onClick={() => onEdit(entry)}>
                  <span className="entry-name">
                    {entry.name}
                    {entry.quantity !== 1 && (
                      <span className="entry-qty"> ×{entry.quantity}</span>
                    )}
                  </span>
                  <span className="entry-macros">
                    C {t.carbs} · P {t.protein} · F {t.fat}
                  </span>
                </button>
                <span className="entry-cal">{t.calories}</span>
                <button
                  className="entry-delete"
                  aria-label={`Delete ${entry.name}`}
                  onClick={() => onDelete(entry.id)}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button className="meal-add" onClick={onAdd}>
        + Add food
      </button>
    </section>
  );
}
