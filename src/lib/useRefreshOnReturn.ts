import { useEffect, useRef } from 'react';

/**
 * How long the app must go unrefreshed before returning to it reloads. Short
 * enough that coming back from a real break gets fresh data, long enough that
 * glancing at another window and back costs nothing.
 */
const STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * Calls `onReturn` when the user comes back to the app after it has gone
 * `staleAfterMs` without a refresh. Tabs get left open for hours on desktop
 * and restored from the background on phones, so without this the log can
 * show data loaded long enough ago to be wrong.
 */
export function useRefreshOnReturn(onReturn: () => void, staleAfterMs: number = STALE_AFTER_MS) {
  // Held in a ref so a new callback identity each render doesn't churn listeners
  const callback = useRef(onReturn);
  callback.current = onReturn;
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefreshAt.current < staleAfterMs) return;
      lastRefreshAt.current = Date.now();
      callback.current();
    };

    // visibilitychange covers desktop tab switching and unlocking; pageshow
    // covers mobile Safari restoring from the back/forward cache, which does
    // not fire visibilitychange; online covers returning from a dead network.
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('pageshow', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('pageshow', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
    };
  }, [staleAfterMs]);
}
