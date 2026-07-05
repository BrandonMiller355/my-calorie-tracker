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
  goals: Goals;
  /** true until the user saves goals for the first time */
  goalsAreDefault: boolean;
  /** true when loading entries or goals from the backend failed */
  loadFailed: boolean;
}

type Action =
  | { type: 'set-date'; date: string }
  | { type: 'entries-loaded'; date: string; entries: FoodEntry[] }
  | { type: 'entry-added'; entry: FoodEntry }
  | { type: 'entry-updated'; entry: FoodEntry }
  | { type: 'entry-deleted'; id: string }
  | { type: 'goals-loaded'; goals: Goals | null }
  | { type: 'goals-saved'; goals: Goals }
  | { type: 'load-failed' }
  | { type: 'retry-load' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-date':
      return { ...state, date: action.date, entriesLoading: true };
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
    case 'goals-loaded':
      return action.goals
        ? { ...state, goals: action.goals, goalsAreDefault: false }
        : state;
    case 'goals-saved':
      return { ...state, goals: action.goals, goalsAreDefault: false };
    case 'load-failed':
      return { ...state, loadFailed: true, entriesLoading: false };
    case 'retry-load':
      return { ...state, loadFailed: false, entriesLoading: true };
  }
}

export interface AppContextValue extends AppState {
  setDate: (date: string) => void;
  /** Re-runs the failed goal/entry loads after loadFailed */
  retryLoad: () => void;
  addEntry: (entry: Omit<FoodEntry, 'id'>) => Promise<void>;
  updateEntry: (entry: FoodEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveGoals: (goals: Goals) => Promise<void>;
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
    goals: DEFAULT_GOALS,
    goalsAreDefault: true,
    loadFailed: false,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    repository.getGoals().then(
      (goals) => {
        if (!cancelled) dispatch({ type: 'goals-loaded', goals });
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

  const saveGoals = useCallback(
    async (goals: Goals) => {
      await repository.saveGoals(goals);
      dispatch({ type: 'goals-saved', goals });
    },
    [repository],
  );

  const value = useMemo<AppContextValue>(
    () => ({ ...state, setDate, retryLoad, addEntry, updateEntry, deleteEntry, saveGoals }),
    [state, setDate, retryLoad, addEntry, updateEntry, deleteEntry, saveGoals],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
