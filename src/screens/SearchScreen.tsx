import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getProductByBarcode, searchFoods } from '../api/openFoodFacts';
import { AiAnalyzeOverlay } from '../components/AiAnalyzeOverlay';
import { BarcodeScanner, isBarcodeScanningSupported } from '../components/BarcodeScanner';
import { unitLabel } from '../lib/units';
import type { FoodSearchResult, Meal } from '../types';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; results: FoodSearchResult[] };

type ScanState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'looking-up' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string; code: string };

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
  const [canScan, setCanScan] = useState(false);
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });
  const [analyzing, setAnalyzing] = useState(false);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isBarcodeScanningSupported().then((supported) => {
      if (!cancelled && supported) setCanScan(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // A found product enters the same select() flow as a text search result;
  // the scanned barcode itself is never persisted.
  async function lookupBarcode(code: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setScan({ kind: 'looking-up' });
    try {
      const result = await getProductByBarcode(code, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result) {
        select(result);
        return;
      }
      setScan({ kind: 'not-found' });
    } catch (err) {
      if (controller.signal.aborted) return;
      setScan({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Barcode lookup failed',
        code,
      });
    }
  }

  const manualEntryLink = (
    <Link to="/" state={{ openManual: true, meal: fromForm?.meal }}>
      add a food manually
    </Link>
  );

  return (
    <div className="search-screen">
      <h1>Search foods</h1>
      <div className="search-actions">
        <input
          className="search-input"
          type="search"
          placeholder="Search Open Food Facts, e.g. “greek yogurt”"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (scan.kind !== 'idle') setScan({ kind: 'idle' });
          }}
          autoFocus
        />
        {canScan && (
          <button
            type="button"
            className="scan-button"
            onClick={() => setScan({ kind: 'scanning' })}
          >
            📷 Scan a barcode
          </button>
        )}
        <button
          type="button"
          className="scan-button"
          onClick={() => setAnalyzing(true)}
        >
          ✨ AI analyze a photo
        </button>
      </div>

      {analyzing && (
        <AiAnalyzeOverlay
          onAccept={select}
          onCancel={() => setAnalyzing(false)}
          fallback={<p>You can still search by name above, or {manualEntryLink}.</p>}
        />
      )}

      {scan.kind === 'scanning' && (
        <BarcodeScanner
          onDetected={(code) => void lookupBarcode(code)}
          onCancel={() => setScan({ kind: 'idle' })}
          fallback={<p>You can still search by name above, or {manualEntryLink}.</p>}
        />
      )}

      {scan.kind === 'looking-up' && <p className="loading">Looking up barcode…</p>}

      {scan.kind === 'not-found' && (
        <div className="search-empty">
          <p>That barcode isn’t in Open Food Facts.</p>
          <p>Try searching by name, or {manualEntryLink}.</p>
        </div>
      )}

      {scan.kind === 'error' && (
        <div className="search-error" role="alert">
          <p>Barcode lookup is unavailable right now ({scan.message}).</p>
          <p>
            <button
              type="button"
              className="link-button"
              onClick={() => void lookupBarcode(scan.code)}
            >
              Retry
            </button>{' '}
            or still {manualEntryLink}.
          </p>
        </div>
      )}

      {state.kind === 'idle' && scan.kind === 'idle' && (
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
