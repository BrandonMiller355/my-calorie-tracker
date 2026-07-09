import { useEffect, useRef, useState } from 'react';
import { buildRequestFoods, identifyFood, type IdentifiedAmount } from '../api/identifyFood';
import type { LibraryFood } from '../types';
import { PhotoCapture } from './PhotoCapture';
import { PhotoConfirm } from './PhotoConfirm';

// Everything here — photo, note, candidates — lives in this component's
// state and dies with it. Nothing is persisted anywhere.
type Phase =
  | { kind: 'capturing' }
  /** Frame captured; camera stopped. Retake goes back to `capturing`. */
  | { kind: 'confirming' }
  | { kind: 'identifying' }
  /** Torn between candidates; the user picks one. */
  | { kind: 'picking'; candidates: LibraryFood[]; amount?: IdentifiedAmount }
  | { kind: 'no-match' }
  /** Identification failed; retry re-sends the same photo and note. */
  | { kind: 'error'; message: string };

interface IdentifyOverlayProps {
  /** The user's library; archived foods are filtered out of the request. */
  foods: LibraryFood[];
  /** A candidate was resolved (confidently or by the chooser). */
  onMatch: (food: LibraryFood, amount?: IdentifiedAmount) => void;
  /** Nothing matched and the user chose to get an AI estimate for the same photo. */
  onEstimateFallback: (image: string, note: string) => void;
  onCancel: () => void;
}

/**
 * Full flow for "identify from photo": photograph a food (typically on the
 * kitchen scale), match it against the food library via the identify-food
 * Edge Function, and resolve to a library food plus an optional weight — or
 * hand the photo off to the AI estimate flow when nothing matches.
 */
export function IdentifyOverlay({ foods, onMatch, onEstimateFallback, onCancel }: IdentifyOverlayProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'capturing' });
  const [image, setImage] = useState<string | null>(null);
  /** Optional context note typed on the pre-send review step. */
  const [note, setNote] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function identify(img: string) {
    const requestFoods = buildRequestFoods(foods);
    // An empty library can't match anything; skip the round trip.
    if (requestFoods.length === 0) {
      setPhase({ kind: 'no-match' });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'identifying' });
    try {
      const result = await identifyFood(
        { image: img, note: note.trim() || undefined, foods: requestFoods },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      // parseResult guarantees every candidate id came from the request, so
      // each one resolves; the filter is belt-and-braces.
      const candidates = result.candidates
        .map((c) => foods.find((f) => f.id === c.id))
        .filter((f): f is LibraryFood => f !== undefined);
      if (candidates.length === 0) {
        setPhase({ kind: 'no-match' });
      } else if (candidates.length === 1) {
        onMatch(candidates[0], result.amount);
      } else {
        setPhase({ kind: 'picking', candidates, amount: result.amount });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Identification failed';
      setPhase({ kind: 'error', message });
    }
  }

  if (phase.kind === 'capturing') {
    return (
      <PhotoCapture
        onCapture={(img) => {
          setImage(img);
          setPhase({ kind: 'confirming' });
        }}
        onCancel={onCancel}
      />
    );
  }

  if (phase.kind === 'confirming' && image) {
    return (
      <PhotoConfirm
        image={image}
        note={note}
        onNoteChange={setNote}
        onRetake={() => {
          setImage(null);
          setPhase({ kind: 'capturing' });
        }}
        onSend={() => void identify(image)}
        onCancel={onCancel}
        sendLabel="Identify"
      />
    );
  }

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Identify food from photo">
      <div className="ai-review">
        {image && <img src={image} alt="Captured food" className="ai-photo" />}

        {phase.kind === 'identifying' && <p className="loading">Matching against your foods…</p>}

        {phase.kind === 'error' && (
          <div className="scanner-error" role="alert">
            <p>The photo couldn’t be identified ({phase.message}).</p>
            <p>
              <button
                type="button"
                className="link-button"
                onClick={() => image && void identify(image)}
              >
                Retry
              </button>
            </p>
          </div>
        )}

        {phase.kind === 'picking' && (
          <>
            <p className="identify-message">Which of these is it?</p>
            <ul className="identify-candidates">
              {phase.candidates.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    className="identify-candidate"
                    onClick={() => onMatch(food, phase.amount)}
                  >
                    <span className="identify-candidate-name">{food.name}</span>
                    {food.description && (
                      <span className="identify-candidate-desc">{food.description}</span>
                    )}
                    <span className="identify-candidate-cal">
                      {food.calories} kcal per {food.servingLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {phase.kind === 'no-match' && (
          <>
            <p className="identify-message">This doesn’t look like anything in your food library.</p>
            <button
              type="button"
              className="ai-accept"
              onClick={() => image && onEstimateFallback(image, note.trim())}
            >
              Get an AI estimate instead
            </button>
            <button type="button" className="secondary" onClick={onCancel}>
              Back to form
            </button>
          </>
        )}
      </div>

      {phase.kind !== 'no-match' && (
        <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
