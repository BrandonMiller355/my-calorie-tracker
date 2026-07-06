import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { searchFoods } from '../api/openFoodFacts';
import { unitLabel } from '../lib/units';
import type { FoodSearchResult, Meal } from '../types';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; results: FoodSearchResult[] };

/** Present when opened from the add-entry form's "search online" action */
interface FromFormState {
  fromForm?: { meal: Meal; date: string; query?: string };
}

const DEBOUNCE_MS = 400;

function fmt(n: number | undefined, unit: string): string {
  return n === undefined ? `— ${unit}` : `${n} ${unit}`;
}

export function SearchScreen() {
  const location = useLocation();
  const fromForm = (location.state as FromFormState | null)?.fromForm;
  const [query, setQuery] = useState(fromForm?.query ?? '');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  async function runSearch(q: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'loading' });
    try {
      const results = await searchFoods(q, { signal: controller.signal });
      setState({ kind: 'done', results });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Search failed',
      });
    }
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ kind: 'idle' });
      return;
    }

    const timer = setTimeout(() => {
      void runSearch(q);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Returning to an in-progress form restores its selected meal
  function select(result: FoodSearchResult) {
    navigate('/', { state: { prefill: result, meal: fromForm?.meal } });
  }

  return (
    <div className="search-screen">
      <h1>Search foods</h1>
      <input
        className="search-input"
        type="search"
        placeholder="Search Open Food Facts, e.g. “greek yogurt”"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {state.kind === 'idle' && (
        <p className="search-hint">
          Type at least 2 characters to search, or{' '}
          <Link to="/" state={{ openManual: true, meal: fromForm?.meal }}>
            add a food manually
          </Link>
          .
        </p>
      )}

      {state.kind === 'loading' && <p className="loading">Searching…</p>}

      {state.kind === 'error' && (
        <div className="search-error" role="alert">
          <p>Food search is unavailable right now ({state.message}).</p>
          <p>
            <button
              type="button"
              className="link-button"
              onClick={() => void runSearch(query.trim())}
            >
              Retry
            </button>{' '}
            or still{' '}
            <Link to="/" state={{ openManual: true, meal: fromForm?.meal }}>
              add a food manually
            </Link>
            .
          </p>
        </div>
      )}

      {state.kind === 'done' && state.results.length === 0 && (
        <div className="search-empty">
          <p>No results for “{query.trim()}”.</p>
          <p>
            Try another term, or{' '}
            <Link to="/" state={{ openManual: true, meal: fromForm?.meal }}>
              add it manually
            </Link>
            .
          </p>
        </div>
      )}

      {state.kind === 'done' && state.results.length > 0 && (
        <>
          <ul className="result-list">
            {state.results.map((r) => (
              <li key={r.id}>
                <button className="result-row" onClick={() => select(r)}>
                  <span className="result-name">
                    {r.name}
                    {r.brand && <span className="result-brand"> · {r.brand}</span>}
                  </span>
                  <span className="result-serving">
                    {r.servingSize
                      ? `1 ${r.servingLabel} = ${r.servingSize.amount} ${unitLabel(r.servingSize.unit)}`
                      : `1 ${r.servingLabel}`}
                  </span>
                  <span className="result-macros">
                    {fmt(r.calories, 'kcal')} · F {fmt(r.fat, 'g')} · C {fmt(r.carbs, 'g')} · P{' '}
                    {fmt(r.protein, 'g')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="search-hint">
            Not what you’re looking for?{' '}
            <Link to="/" state={{ openManual: true, meal: fromForm?.meal }}>
              Add a new food manually
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
