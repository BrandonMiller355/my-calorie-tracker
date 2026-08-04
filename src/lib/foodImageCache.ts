/**
 * Process-wide cache of resolved signed URLs for food photos, keyed by storage
 * object path. Signed URLs live an hour; caching them for slightly less keeps
 * re-renders (and re-opening the library) from re-signing every image.
 *
 * Because a replaced photo reuses the same object key, its path doesn't change
 * — so replacing must explicitly invalidate the cached URL (and nudge mounted
 * thumbnails to re-sign) or the stale image would linger until a full reload.
 */
const CACHE_TTL_MS = 55 * 60 * 1000;
const cache = new Map<string, { url: string; expiresAt: number }>();
const listeners = new Set<() => void>();

export function getCachedFoodImageUrl(path: string): string | null {
  const hit = cache.get(path);
  return hit && hit.expiresAt > Date.now() ? hit.url : null;
}

export function setCachedFoodImageUrl(path: string, url: string): void {
  cache.set(path, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Drops the cached URL for a path and notifies thumbnails to re-resolve. */
export function invalidateFoodImage(path: string): void {
  cache.delete(path);
  listeners.forEach((l) => l());
}

/** Subscribe to invalidations; returns an unsubscribe function. */
export function subscribeFoodImages(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
