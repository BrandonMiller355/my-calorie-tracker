/**
 * Transient, non-interactive message shown above the bottom tab bar. It has no
 * dismiss control by design: every message is short-lived and its owner clears
 * it, so there is nothing here for a stray tap to hit.
 */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
