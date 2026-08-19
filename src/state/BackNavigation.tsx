import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toast } from '../components/Toast';

/** What a layer does with a back press: dismiss itself, or step its phase back. */
type BackHandler = () => void;

interface BackNavigationValue {
  /** Adds a handler to the top of the stack; the returned function removes it. */
  register: (handler: BackHandler) => () => void;
  showToast: (message: string) => void;
}

const BackNavigationContext = createContext<BackNavigationValue | null>(null);

export const EXIT_HINT = 'Press back again to exit the application';
/** How long a second back press keeps meaning "exit" — and how long the hint shows. */
export const EXIT_WINDOW_MS = 2000;

/**
 * Turns the platform back signal into an in-app action instead of a history
 * navigation: dismiss the topmost layer, else return to the Log tab, else warn
 * once and let the second press leave.
 *
 * The app keeps itself exactly one history entry above a scratch entry and
 * answers every pop by pushing that entry back, so the depth is always 1 or 2.
 * That bound is what makes the exit work: when the guard is armed we simply
 * stop re-pushing, leaving the app at the history boundary so the next press
 * is the browser's own "leave" rather than something this code has to fake.
 */
export function BackNavigationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const handlers = useRef<BackHandler[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // The listeners below are registered once, so everything they read at press
  // time lives in a ref rather than in their closure.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const locationRef = useRef(location);
  locationRef.current = location;

  const armed = useRef(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Re-establishes the scratch entry, so back never sits at the boundary.
   *
   * Restoring the current entry has to carry its `state` across too — screens
   * hand each other context that way (the search screen's in-progress form,
   * the day log's prefill), and a push without it would silently drop what the
   * screen is mid-way through. A push to an explicit path is a real move to a
   * different screen, so it deliberately starts with no state.
   */
  const pushGuard = useCallback((path?: string) => {
    if (path !== undefined) {
      navigateRef.current(path);
      return;
    }
    const { pathname, search, state } = locationRef.current;
    navigateRef.current(`${pathname}${search}`, { state });
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string) => {
      hideToast();
      setToast(message);
      toastTimer.current = setTimeout(() => {
        toastTimer.current = null;
        setToast(null);
      }, EXIT_WINDOW_MS);
    },
    [hideToast],
  );

  /**
   * Cancels an armed exit and puts the guard entry back. Anything that gives
   * back something to do again — a layer opening, a navigation — must call
   * this, or the app would still be sitting at the boundary when the user
   * presses back expecting that new thing to be dismissed.
   */
  const disarm = useCallback(() => {
    if (!armed.current) return;
    armed.current = false;
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    hideToast();
    pushGuard();
  }, [hideToast, pushGuard]);

  const register = useCallback(
    (handler: BackHandler) => {
      disarm();
      handlers.current.push(handler);
      return () => {
        handlers.current = handlers.current.filter((h) => h !== handler);
      };
    },
    [disarm],
  );

  /** Runs the topmost layer's handler, if there is one. Shared by back and Escape. */
  const dismissTopLayer = useCallback(() => {
    const top = handlers.current[handlers.current.length - 1];
    if (!top) return false;
    top();
    return true;
  }, []);

  // Establish the scratch entry once. The ref guard keeps StrictMode's second
  // effect pass from stacking a duplicate, which would cost an extra press.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    pushGuard();
  }, [pushGuard]);

  useEffect(() => {
    // Deliberately a passive effect: BrowserRouter attaches its own popstate
    // listener in a layout effect, so it is registered — and therefore runs —
    // first. The router settles on the popped entry, this handler pushes the
    // intended one back, and React batches both into a single commit, so the
    // screen behind an open layer is never unmounted in between.
    function onPopState() {
      if (dismissTopLayer()) {
        pushGuard();
        return;
      }
      if (locationRef.current.pathname !== '/') {
        pushGuard('/');
        return;
      }
      // Already at the boundary with the guard armed: leave it alone and let
      // the browser close the app.
      if (armed.current) return;

      armed.current = true;
      showToast(EXIT_HINT);
      armTimer.current = setTimeout(() => {
        armTimer.current = null;
        armed.current = false;
        pushGuard();
      }, EXIT_WINDOW_MS);
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [dismissTopLayer, pushGuard, showToast]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      // Escape stops at the layers: closing a dialog never means "quit".
      if (dismissTopLayer()) e.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissTopLayer]);

  // A navigation during the exit window would otherwise leave the app at the
  // boundary, where the next back press quits instead of unwinding the new
  // screen. Disarming is a no-op on the pushes disarm itself makes.
  useEffect(() => {
    disarm();
  }, [location, disarm]);

  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const value = useMemo<BackNavigationValue>(
    () => ({ register, showToast }),
    [register, showToast],
  );

  return (
    <BackNavigationContext.Provider value={value}>
      {children}
      <Toast message={toast} />
    </BackNavigationContext.Provider>
  );
}

/**
 * Registers `handler` as the response to back (and Escape) while `active`.
 * Handlers stack, so the most recently opened layer is the one that answers.
 *
 * A no-op without a provider above it, so components stay renderable on their
 * own in tests.
 */
export function useBackHandler(active: boolean, handler: BackHandler) {
  const ctx = useContext(BackNavigationContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active || !ctx) return;
    // Registered through a stable wrapper so a handler that is redefined each
    // render doesn't re-register — which would quietly move the layer to the
    // top of the stack.
    return ctx.register(() => handlerRef.current());
  }, [active, ctx]);
}

/** Shows a transient message. No-op without a provider. */
export function useToast() {
  return useContext(BackNavigationContext)?.showToast ?? (() => {});
}
