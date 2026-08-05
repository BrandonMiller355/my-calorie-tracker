import { renderHook } from '@testing-library/react';
import { useRefreshOnReturn } from './useRefreshOnReturn';

const STALE_MS = 1000;

/** jsdom reports visibilityState as a read-only 'visible'; this overrides it. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

/**
 * Fully synthetic clock — nothing here waits on real time, so the elapsed
 * milliseconds a test sees are exactly the ones it asked for.
 */
let now = 0;

function advanceClock(ms: number) {
  now += ms;
}

beforeEach(() => {
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  setVisibility('visible');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRefreshOnReturn', () => {
  it('refreshes when the user returns after the staleness window', () => {
    const onReturn = vi.fn();
    renderHook(() => useRefreshOnReturn(onReturn, STALE_MS));

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    advanceClock(STALE_MS + 1);
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('ignores a quick glance away and back', () => {
    const onReturn = vi.fn();
    renderHook(() => useRefreshOnReturn(onReturn, STALE_MS));

    advanceClock(STALE_MS - 1);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onReturn).not.toHaveBeenCalled();
  });

  it('does not refresh when the app is being hidden', () => {
    const onReturn = vi.fn();
    renderHook(() => useRefreshOnReturn(onReturn, STALE_MS));

    advanceClock(STALE_MS + 1);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onReturn).not.toHaveBeenCalled();
  });

  it('refreshes on pageshow, which is all mobile Safari fires from bfcache', () => {
    const onReturn = vi.fn();
    renderHook(() => useRefreshOnReturn(onReturn, STALE_MS));

    advanceClock(STALE_MS + 1);
    window.dispatchEvent(new Event('pageshow'));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('restarts the staleness window after each refresh', () => {
    const onReturn = vi.fn();
    renderHook(() => useRefreshOnReturn(onReturn, STALE_MS));

    advanceClock(STALE_MS + 1);
    document.dispatchEvent(new Event('visibilitychange'));
    // A second return right afterwards is within the window of the first
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', () => {
    const onReturn = vi.fn();
    const { unmount } = renderHook(() => useRefreshOnReturn(onReturn, STALE_MS));

    unmount();
    advanceClock(STALE_MS + 1);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onReturn).not.toHaveBeenCalled();
  });
});
