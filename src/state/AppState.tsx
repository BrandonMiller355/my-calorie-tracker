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
import { todayKey } from '../lib/date';
import type { StorageRepository } from '../storage';
import { DEFAULT_GOALS, type FoodEntry, type Goals } from '../types';

interface AppState {
  date: string;
  entries: FoodEntry[];
  entriesLoading: boolean;
  defaultGoals: Goals;
  /** true until the user saves default goals for the first time */
  goalsAreDefault: boolean;
  /** override for `date`; null when this day uses defaultGoals */
  dayGoalOverride: Goals | null;
  /** true when loading entries or goals from the backend failed */
  loadFailed: boolean;
}

type Action =
  | { type: 'set-date'; date: string }
  | { type: 'entries-loaded'; date: string; entries: FoodEntry[] }
  | { type: 'entry-added'; entry: FoodEntry }
  | { type: 'entry-updated'; entry: FoodEntry }
  | { type: 'entry-deleted'; id: string }
  | { type: 'default-goals-loaded'; goals: Goals | null }
  | { type: 'default-goals-saved'; goals: Goals }
  | { type: 'day-goal-loaded'; date: string; goals: Goals | null }
  | { type: 'day-goal-saved'; goals: Goals }
  | { type: 'day-goal-cleared' }
  | { type: 'load-failed' }
  | { type: 'retry-load' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-date':
      return { ...state, date: action.date, entriesLoading: true, dayGoalOverride: null };
    case 'entries-loaded':
      // Ignore loads for a date the user has already navigated away from
      if (action.date !== state.date) return state;
      return { ...state, entries: action.entries, entriesLoading: false };
    case 'entry-added':
      if (action.entry.date !== state.date) return state;
      return { ...state, entries: [...state.entries, action.entry] };
    case 'entry-updated': {
      const remaining = state.entries.filter((e) => e.id !== action.entry.id);
      // The edit may have moved the entry to another date
      if (action.entry.date === state.date) remaining.push(action.entry);
      return { ...state, entries: remaining };
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
    case 'load-failed':
      return { ...state, loadFailed: true, entriesLoading: false };
    case 'retry-load':
      return { ...state, loadFailed: false, entriesLoading: true };
  }
}

export interface AppContextValue extends AppState {
  /** Effective goals for `date`: dayGoalOverride if set, else defaultGoals */
  goals: Goals;
  /** true when `date` has its own override rather than using defaultGoals */
  dayGoalIsOverridden: boolean;
  setDate: (date: string) => void;
  /** Re-runs the failed goal/entry loads after loadFailed */
  retryLoad: () => void;
  addEntry: (entry: Omit<FoodEntry, 'id'>) => Promise<void>;
  updateEntry: (entry: FoodEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveDefaultGoals: (goals: Goals) => Promise<void>;
  /** Sets an override for the current `date` only. */
  saveDayGoals: (goals: Goals) => Promise<void>;
  /** Removes the current date's override, reverting it to defaultGoals. */
  clearDayGoals: () => Promise<void>;
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
    loadFailed: false,
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

  const setDate = useCallback((date: string) => dispatch({ type: 'set-date', date }), []);

  const retryLoad = useCallback(() => {
    dispatch({ type: 'retry-load' });
    setReloadKey((k) => k + 1);
  }, []);

  const addEntry = useCallback(
    async (input: Omit<FoodEntry, 'id'>) => {
      const entry: FoodEntry = { ...input, id: crypto.randomUUID() };
      await repository.addEntry(entry);
      dispatch({ type: 'entry-added', entry });
    },
    [repository],
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

  const goals = state.dayGoalOverride ?? state.defaultGoals;
  const dayGoalIsOverridden = state.dayGoalOverride !== null;

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      goals,
      dayGoalIsOverridden,
      setDate,
      retryLoad,
      addEntry,
      updateEntry,
      deleteEntry,
      saveDefaultGoals,
      saveDayGoals,
      clearDayGoals,
    }),
    [
      state,
      goals,
      dayGoalIsOverridden,
      setDate,
      retryLoad,
      addEntry,
      updateEntry,
      deleteEntry,
      saveDefaultGoals,
      saveDayGoals,
      clearDayGoals,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
