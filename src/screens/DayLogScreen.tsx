import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DateNav } from '../components/DateNav';
import { DayGoalEditor } from '../components/DayGoalEditor';
import { EntryForm } from '../components/EntryForm';
import { MealSection } from '../components/MealSection';
import { Summary } from '../components/Summary';
import { WeeklyDeficit } from '../components/WeeklyDeficit';
import { sumTotals } from '../lib/totals';
import { useAppState } from '../state/AppState';
import { MEALS, type FoodEntry, type FoodSearchResult, type Meal } from '../types';

type FormMode =
  | { kind: 'add'; meal: Meal }
  | { kind: 'edit'; entry: FoodEntry }
  | { kind: 'prefill'; prefill: FoodSearchResult; meal?: Meal }
  | null;

interface LocationState {
  prefill?: FoodSearchResult;
  openManual?: boolean;
  /** Meal the add-entry form had selected before escalating to online search */
  meal?: Meal;
}

export function DayLogScreen() {
  const {
    date,
    entries,
    entriesLoading,
    goals,
    goalsAreDefault,
    dayGoalIsOverridden,
    loadFailed,
    retryLoad,
    setDate,
    deleteEntry,
    saveDayGoals,
    clearDayGoals,
    weeklyDeficitToDate,
    weeklyDeficitGoal,
    weeklyDeficitMissingDays,
  } = useAppState();
  const [form, setForm] = useState<FormMode>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Arriving from the search screen with a selected result (or manual fallback)
  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.prefill) {
      setForm({ kind: 'prefill', prefill: state.prefill, meal: state.meal });
      navigate(location.pathname, { replace: true, state: null });
    } else if (state?.openManual) {
      setForm({ kind: 'add', meal: state.meal ?? 'snacks' });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const totals = sumTotals(entries);

  if (loadFailed) {
    return (
      <div className="day-log">
        <DateNav date={date} onChange={setDate} />
        <div className="load-error" role="alert">
          <p>Couldn’t reach the server, so your log can’t be loaded right now.</p>
          <button type="button" onClick={retryLoad}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="day-log">
      <DateNav date={date} onChange={setDate} />
      <Summary totals={totals} goals={goals} goalsAreDefault={goalsAreDefault} />
      <WeeklyDeficit
        deficit={weeklyDeficitToDate}
        goal={weeklyDeficitGoal}
        hasMissingDays={weeklyDeficitMissingDays}
      />
      <DayGoalEditor
        key={date}
        date={date}
        goals={goals}
        dayGoalIsOverridden={dayGoalIsOverridden}
        onSave={saveDayGoals}
        onClear={clearDayGoals}
      />

      {deleteFailed && (
        <p className="error-banner" role="alert">
          Couldn’t delete the entry — it was not removed. Check your connection and try again.
        </p>
      )}

      {entriesLoading ? (
        <p className="loading">Loading…</p>
      ) : (
        MEALS.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={entries.filter((e) => e.meal === meal)}
            onAdd={() => setForm({ kind: 'add', meal })}
            onEdit={(entry) => setForm({ kind: 'edit', entry })}
            onDelete={(id) => {
              setDeleteFailed(false);
              deleteEntry(id).catch(() => setDeleteFailed(true));
            }}
          />
        ))
      )}

      {form && (
        <EntryForm
          date={date}
          editing={form.kind === 'edit' ? form.entry : undefined}
          prefill={form.kind === 'prefill' ? form.prefill : undefined}
          defaultMeal={form.kind === 'add' || form.kind === 'prefill' ? form.meal : undefined}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
