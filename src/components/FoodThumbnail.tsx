import { useEffect, useState, type ReactNode } from 'react';
import {
  getCachedFoodImageUrl,
  setCachedFoodImageUrl,
  subscribeFoodImages,
} from '../lib/foodImageCache';
import { useAppState } from '../state/AppState';
import { useBackHandler } from '../state/BackNavigation';
import type { LibraryFood } from '../types';

/**
 * Lazily displays a food's photo via a short-lived signed URL. Renders nothing
 * for a food with no photo, while its URL is resolving, or if the resolve
 * fails — so the surrounding row degrades to its normal text-only form. When
 * `enlargeable`, the thumbnail is a button that opens the photo full-size.
 */
export function FoodThumbnail({
  food,
  className,
  enlargeable,
  renderActions,
}: {
  food: LibraryFood;
  className?: string;
  enlargeable?: boolean;
  /** Action controls (e.g. replace/remove) shown only on the enlarged view. */
  renderActions?: (close: () => void) => ReactNode;
}) {
  const { getFoodImageUrl } = useAppState();
  const path = food.imagePath;
  const [url, setUrl] = useState<string | null>(() => (path ? getCachedFoodImageUrl(path) : null));
  // Bumped when a photo is replaced/removed so the effect re-signs even though
  // the object path (and thus its deps) hasn't changed.
  const [refresh, setRefresh] = useState(0);

  useEffect(() => subscribeFoodImages(() => setRefresh((n) => n + 1)), []);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = getCachedFoodImageUrl(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    getFoodImageUrl(path).then(
      (resolved) => {
        setCachedFoodImageUrl(path, resolved);
        if (!cancelled) setUrl(resolved);
      },
      () => {
        if (!cancelled) setUrl(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, getFoodImageUrl, refresh]);

  if (!path || !url) return null;

  return (
    <PhotoThumbnail
      url={url}
      name={food.name}
      className={className}
      enlargeable={enlargeable}
      renderActions={renderActions}
    />
  );
}

/**
 * The thumbnail itself, given a ready-to-use image URL — so it serves both a
 * stored photo (via FoodThumbnail's signed URL) and one just captured but not
 * yet uploaded, as when adding a food.
 */
export function PhotoThumbnail({
  url,
  name,
  className,
  enlargeable,
  renderActions,
}: {
  url: string;
  /** Names the photo for assistive tech — the food's name, or what it will be. */
  name: string;
  className?: string;
  enlargeable?: boolean;
  renderActions?: (close: () => void) => ReactNode;
}) {
  const [enlarged, setEnlarged] = useState(false);

  // Back (and Escape, through the same stack) returns to whatever the photo was
  // opened from, rather than leaving the app.
  useBackHandler(enlarged, () => setEnlarged(false));

  const img = <img src={url} alt={name} className={className ?? 'food-thumb'} />;
  if (!enlargeable) return img;

  return (
    <>
      <button
        type="button"
        className="food-thumb-button"
        onClick={() => setEnlarged(true)}
        aria-label={`View ${name} photo`}
      >
        {img}
      </button>
      {enlarged && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-label={`${name} photo`}
          onClick={() => setEnlarged(false)}
        >
          <div className="image-lightbox-figure">
            <img src={url} alt={name} className="image-lightbox-img" />
            {renderActions && (
              <div className="image-lightbox-actions" onClick={(e) => e.stopPropagation()}>
                {renderActions(() => setEnlarged(false))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
