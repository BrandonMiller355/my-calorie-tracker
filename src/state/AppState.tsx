import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { startOfWeek, todayKey } from '../lib/date';
import { findFoodByName } from '../lib/foodMatch';
import { computeWeeklyDeficit } from '../lib/weeklyDeficit';
import type { StorageRepository } from '../storage';
import {
  DEFAULT_GOALS,
  type DayGoalOverride,
  type FoodEntry,
  type Goals,
  type LibraryFood,
  type Meal,
  type MealSuggestions,
  type WeekDeficitDay,
} from '../types';

interface AppState {
  date: string;
  entries: FoodEntry[];
  entriesLoading: boolean;
  defaultGoals: Goals;
  /** true until the user saves default goals for the first time */
  goalsAreDefault: boolean;
  /**
   * Override for `date`; null when this day uses defaultGoals. May be
   * calories-only (null macros) when written by the external burn sync.
   */
  dayGoalOverride: DayGoalOverride | null;
  /** Non-archived food library, loaded once per session */
  foods: LibraryFood[];
  /**
   * Food id → local date (YYYY-MM-DD) it was last logged, for recency-first
   * name search. Loaded once per session, then kept fresh as entries save.
   */
  foodLastUsed: Record<string, string>;
  /** true when loading entries or goals from the backend failed */
  loadFailed: boolean;
  /** null when the user has never set a weekly deficit goal */
  weeklyDeficitGoal: number | null;
  /** Per-day breakdown from that week's Monday through `date`, inclusive */
  weekSummary: WeekDeficitDay[];
  weekSummaryLoading: boolean;
}

type Action =
  | { type: 'set-date'; date: string }
  | { type: 'entries-loaded'; date: string; entries: FoodEntry[] }
  | { type: 'entry-added'; entry: FoodEntry }
  | { type: 'entry-updated'; entry: FoodEntry }
  | { type: 'entry-deleted'; id: string }
  | { type: 'default-goals-loaded'; goals: Goals | null }
  | { type: 'default-goals-saved'; goals: Goals }
  | { type: 'day-goal-loaded'; date: string; goals: DayGoalOverride | null }
  | { type: 'day-goal-saved'; goals: Goals }
  | { type: 'day-goal-cleared' }
  | { type: 'foods-loaded'; foods: LibraryFood[] }
  | { type: 'food-last-used-loaded'; lastUsed: Record<string, string> }
  | { type: 'food-added'; food: LibraryFood }
  | { type: 'food-updated'; food: LibraryFood }
  | { type: 'food-archived'; id: string }
  | { type: 'weekly-deficit-goal-loaded'; goal: number | null }
  | { type: 'weekly-deficit-goal-saved'; goal: number }
  | { type: 'week-summary-loaded'; date: string; days: WeekDeficitDay[] }
  | { type: 'load-failed' }
  | { type: 'retry-load' };

/** Records `entry` as a use of its food when it's the newest use known. */
function withEntryUse(
  lastUsed: Record<string, string>,
  entry: FoodEntry,
): Record<string, string> {
  if (!entry.foodId) return lastUsed;
  const existing = lastUsed[entry.foodId];
  if (existing !== undefined && existing >= entry.date) return lastUsed;
  return { ...lastUsed, [entry.foodId]: entry.date };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-date':
      return {
        ...state,
        date: action.date,
        entriesLoading: true,
        dayGoalOverride: null,
        weekSummaryLoading: true,
      };
    case 'entries-loaded':
      // Ignore loads for a date the user has already navigated away from
      if (action.date !== state.date) return state;
      return { ...state, entries: action.entries, entriesLoading: false };
    case 'entry-added': {
      // The food's last use advances even when the entry targets another date
      const foodLastUsed = withEntryUse(state.foodLastUsed, action.entry);
      if (action.entry.date !== state.date) return { ...state, foodLastUsed };
      return { ...state, foodLastUsed, entries: [...state.entries, action.entry] };
    }
    case 'entry-updated': {
      const remaining = state.entries.filter((e) => e.id !== action.entry.id);
      // The edit may have moved the entry to another date
      if (action.entry.date === state.date) remaining.push(action.entry);
      return {
        ...state,
        entries: remaining,
        foodLastUsed: withEntryUse(state.foodLastUsed, action.entry),
      };
    }
    case 'entry-deleted':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };
    case 'default-goals-loaded':
      return action.goals
        ? { ...state, defaultGoals: action.goals, goalsAreDefault: false }
        : state;
    case 'default-goals-saved':
      return { ...state, defaultGoals: action.goals, goalsAreDefault: false };
    case 'day-goal-loaded':
      // Ignore loads for a date the user has already navigated away from
      if (action.date !== state.date) return state;
      return { ...state, dayGoalOverride: action.goals };
    case 'day-goal-saved':
      return { ...state, dayGoalOverride: action.goals };
    case 'day-goal-cleared':
      return { ...state, dayGoalOverride: null };
    case 'foods-loaded':
      return { ...state, foods: action.foods };
    case 'food-last-used-loaded':
      return { ...state, foodLastUsed: action.lastUsed };
    case 'food-added':
      return { ...state, foods: [...state.foods, action.food] };
    case 'food-updated':
      return {
        ...state,
        foods: state.foods.map((f) => (f.id === action.food.id ? action.food : f)),
      };
    case 'food-archived':
      return { ...state, foods: state.foods.filter((f) => f.id !== action.id) };
    case 'weekly-deficit-goal-loaded':
      return { ...state, weeklyDeficitGoal: action.goal };
    case 'weekly-deficit-goal-saved':
      return { ...state, weeklyDeficitGoal: action.goal };
    case 'week-summary-loaded':
      // Ignore loads for a date the user has already navigated away from
      if (action.date !== state.date) return state;
      return { ...state, weekSummary: action.days, weekSummaryLoading: false };
    case 'load-failed':
      return { ...state, loadFailed: true, entriesLoading: false, weekSummaryLoading: false };
    case 'retry-load':
      return { ...state, loadFailed: false, entriesLoading: true, weekSummaryLoading: true };
  }
}

/**
 * addEntry input: `description` and `recipe` are not stored on the entry —
 * they seed the library food when the entry is auto-captured as a new food.
 * Exception: quick entries (source 'quick') skip capture entirely and keep
 * their description on the entry itself.
 */
export type NewEntryInput = Omit<FoodEntry, 'id'> & { description?: string; recipe?: string };

export interface AppContextValue extends AppState {
  /**
   * Effective goals for `date`, merged per field: the override's value where
   * present, defaultGoals' where absent (calories-only overrides have null
   * macros). No override at all means defaultGoals unchanged.
   */
  goals: Goals;
  /** true when `date` has its own override rather than using defaultGoals */
  dayGoalIsOverridden: boolean;
  /** Sum of (calorie burn goal - consumed) from that week's Monday through `date` */
  weeklyDeficitToDate: number;
  /**
   * true when a day strictly before `date` in `weekSummary` has zero entries,
   * or `date` itself does when `date` is not today (today's own emptiness
   * doesn't count, since today isn't over yet).
   */
  weeklyDeficitMissingDays: boolean;
  setDate: (date: string) => void;
  /** Re-runs the failed goal/entry loads after loadFailed */
  retryLoad: () => void;
  addEntry: (entry: NewEntryInput) => Promise<void>;
  updateEntry: (entry: FoodEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveDefaultGoals: (goals: Goals) => Promise<void>;
  /** Sets an override for the current `date` only. */
  saveDayGoals: (goals: Goals) => Promise<void>;
  /** Removes the current date's override, reverting it to defaultGoals. */
  clearDayGoals: () => Promise<void>;
  addFood: (food: Omit<LibraryFood, 'id'>) => Promise<void>;
  updateFood: (food: LibraryFood) => Promise<void>;
  archiveFood: (id: string) => Promise<void>;
  getMealSuggestions: (meal: Meal) => Promise<MealSuggestions>;
  saveWeeklyDeficitGoal: (goal: number) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  repository,
  children,
}: {
  repository: StorageRepository;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    date: todayKey(),
    entries: [],
    entriesLoading: true,
    defaultGoals: DEFAULT_GOALS,
    goalsAreDefault: true,
    dayGoalOverride: null,
    foods: [],
    foodLastUsed: {},
    loadFailed: false,
    weeklyDeficitGoal: null,
    weekSummary: [],
    weekSummaryLoading: true,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    repository.getDefaultGoals().then(
      (goals) => {
        if (!cancelled) dispatch({ type: 'default-goals-loaded', goals });
      },
      () => {
        if (!cancelled) dispatch({ type: 'load-failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    repository.getEntriesByDate(state.date).then(
      (entries) => {
        if (!cancelled) dispatch({ type: 'entries-loaded', date: state.date, entries });
      },
      () => {
        if (!cancelled) dispatch({ type: 'load-failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, state.date, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    repository.getGoalsForDate(state.date).then(
      (goals) => {
        if (!cancelled) dispatch({ type: 'day-goal-loaded', date: state.date, goals });
      },
      () => {
        if (!cancelled) dispatch({ type: 'load-failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, state.date, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    repository.getWeeklyDeficitGoal().then(
      (goal) => {
        if (!cancelled) dispatch({ type: 'weekly-deficit-goal-loaded', goal });
      },
      () => {
        if (!cancelled) dispatch({ type: 'load-failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    repository.getWeekDeficitSummary(startOfWeek(state.date), state.date).then(
      (days) => {
        if (!cancelled) dispatch({ type: 'week-summary-loaded', date: state.date, days });
      },
      () => {
        if (!cancelled) dispatch({ type: 'load-failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, state.date, reloadKey]);

  // The food library only powers suggestions and auto-capture, so unlike
  // entries/goals a failed load degrades silently instead of blocking the app.
  useEffect(() => {
    let cancelled = false;
    repository.getFoods().then(
      (foods) => {
        if (!cancelled) dispatch({ type: 'foods-loaded', foods });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [repository, reloadKey]);

  // Usage recency only orders name-search results, so a failed load likewise
  // degrades silently (matches just fall back to alphabetical order).
  useEffect(() => {
    let cancelled = false;
    repository.getFoodLastUsed().then(
      (lastUsed) => {
        if (!cancelled) dispatch({ type: 'food-last-used-loaded', lastUsed });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [repository, reloadKey]);

  const setDate = useCallback((date: string) => dispatch({ type: 'set-date', date }), []);

  const retryLoad = useCallback(() => {
    dispatch({ type: 'retry-load' });
    setReloadKey((k) => k + 1);
  }, []);

  const addEntry = useCallback(
    async (input: NewEntryInput) => {
      const { description, recipe, ...entryInput } = input;
      // Quick calories-only entries never create, match, or link a library
      // food — even if one named "Calories" exists.
      if (entryInput.source === 'quick') {
        const entry: FoodEntry = {
          ...entryInput,
          description: description?.trim() || undefined,
          foodId: undefined,
          id: crypto.randomUUID(),
        };
        await repository.addEntry(entry);
        dispatch({ type: 'entry-added', entry });
        return;
      }
      // Auto-capture: link to the library food, capturing a new one when the
      // name is unknown. Existing foods are never updated from the log form,
      // and a capture failure must not block the entry save.
      let foodId = entryInput.foodId;
      if (foodId === undefined) {
        const existing = findFoodByName(state.foods, entryInput.name);
        if (existing) {
          foodId = existing.id;
        } else {
          const food: LibraryFood = {
            id: crypto.randomUUID(),
            name: entryInput.name,
            description: description?.trim() || undefined,
            recipe: recipe?.trim() || undefined,
            servingLabel: entryInput.servingLabel,
            servingSize: entryInput.servingSize,
            calories: entryInput.calories,
            carbs: entryInput.carbs,
            protein: entryInput.protein,
            fat: entryInput.fat,
            source: entryInput.source,
          };
          try {
            await repository.addFood(food);
            dispatch({ type: 'food-added', food });
            foodId = food.id;
          } catch {
            // Best-effort: save the entry unlinked; a later log can capture it.
          }
        }
      }
      const entry: FoodEntry = { ...entryInput, foodId, id: crypto.randomUUID() };
      await repository.addEntry(entry);
      dispatch({ type: 'entry-added', entry });
    },
    [repository, state.foods],
  );

  const updateEntry = useCallback(
    async (entry: FoodEntry) => {
      await repository.updateEntry(entry);
      dispatch({ type: 'entry-updated', entry });
    },
    [repository],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await repository.deleteEntry(id);
      dispatch({ type: 'entry-deleted', id });
    },
    [repository],
  );

  const saveDefaultGoals = useCallback(
    async (goals: Goals) => {
      await repository.saveDefaultGoals(goals);
      dispatch({ type: 'default-goals-saved', goals });
    },
    [repository],
  );

  const saveDayGoals = useCallback(
    async (goals: Goals) => {
      await repository.saveGoalsForDate(state.date, goals);
      dispatch({ type: 'day-goal-saved', goals });
    },
    [repository, state.date],
  );

  const clearDayGoals = useCallback(async () => {
    await repository.clearGoalsForDate(state.date);
    dispatch({ type: 'day-goal-cleared' });
  }, [repository, state.date]);

  const addFood = useCallback(
    async (input: Omit<LibraryFood, 'id'>) => {
      const food: LibraryFood = { ...input, id: crypto.randomUUID() };
      await repository.addFood(food);
      dispatch({ type: 'food-added', food });
    },
    [repository],
  );

  const updateFood = useCallback(
    async (food: LibraryFood) => {
      await repository.updateFood(food);
      dispatch({ type: 'food-updated', food });
    },
    [repository],
  );

  const archiveFood = useCallback(
    async (id: string) => {
      await repository.archiveFood(id);
      dispatch({ type: 'food-archived', id });
    },
    [repository],
  );

  const getMealSuggestions = useCallback(
    (meal: Meal) => repository.getMealSuggestions(meal),
    [repository],
  );

  const saveWeeklyDeficitGoal = useCallback(
    async (goal: number) => {
      await repository.saveWeeklyDeficitGoal(goal);
      dispatch({ type: 'weekly-deficit-goal-saved', goal });
    },
    [repository],
  );

  const { dayGoalOverride, defaultGoals } = state;
  const goals = useMemo<Goals>(
    () =>
      dayGoalOverride
        ? {
            calories: dayGoalOverride.calories,
            carbs: dayGoalOverride.carbs ?? defaultGoals.carbs,
            protein: dayGoalOverride.protein ?? defaultGoals.protein,
            fat: dayGoalOverride.fat ?? defaultGoals.fat,
          }
        : defaultGoals,
    [dayGoalOverride, defaultGoals],
  );
  const dayGoalIsOverridden = dayGoalOverride !== null;

  const { deficit: weeklyDeficitToDate, hasMissingDays: weeklyDeficitMissingDays } =
    computeWeeklyDeficit(state.weekSummary, state.date, todayKey());

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      goals,
      dayGoalIsOverridden,
      weeklyDeficitToDate,
      weeklyDeficitMissingDays,
      setDate,
      retryLoad,
      addEntry,
      updateEntry,
      deleteEntry,
      saveDefaultGoals,
      saveDayGoals,
      clearDayGoals,
      addFood,
      updateFood,
      archiveFood,
      getMealSuggestions,
      saveWeeklyDeficitGoal,
    }),
    [
      state,
      goals,
      dayGoalIsOverridden,
      weeklyDeficitToDate,
      weeklyDeficitMissingDays,
      setDate,
      retryLoad,
      addEntry,
      updateEntry,
      deleteEntry,
      saveDefaultGoals,
      saveDayGoals,
      clearDayGoals,
      addFood,
      updateFood,
      archiveFood,
      getMealSuggestions,
      saveWeeklyDeficitGoal,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
