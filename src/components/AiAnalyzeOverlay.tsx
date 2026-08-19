import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { analyzeFood, mapEstimateToResult, type FoodEstimate } from '../api/analyzeFood';
import { useBackHandler } from '../state/BackNavigation';
import type { FoodSearchResult } from '../types';
import { ClearableInput } from './ClearableInput';
import { PhotoCapture } from './PhotoCapture';
import { PhotoConfirm } from './PhotoConfirm';

// The whole conversation — photo, corrections, estimates — lives in this
// component's state and dies with it. Nothing here is persisted anywhere.
type Phase =
  | { kind: 'capturing' }
  /** Frame captured; camera stopped. Retake goes back to `capturing`. */
  | { kind: 'confirming' }
  | { kind: 'analyzing' }
  | { kind: 'review'; estimate: FoodEstimate }
  | { kind: 'refining'; estimate: FoodEstimate }
  /** Initial analysis failed; retry re-analyzes the same photo (and note). */
  | { kind: 'analyze-error'; message: string }
  /** A refinement failed; the prior estimate stays usable and the correction can be retried. */
  | { kind: 'refine-error'; estimate: FoodEstimate; message: string; failedCorrection: string };

interface AiAnalyzeOverlayProps {
  /**
   * The analyzed photo comes along with the estimate so a host that can hold it
   * may offer it as the photo for a food captured from the resulting entry. It
   * is deliberately not part of `FoodSearchResult`: hosts that navigate on
   * accept carry that type through router state, which is no place for a
   * base64 JPEG. A host with nowhere to put it simply ignores it.
   */
  onAccept: (result: FoodSearchResult, image: string) => void;
  onCancel: () => void;
  /** Rendered under camera/analysis errors (e.g. a manual-entry link). */
  fallback?: ReactNode;
  /** Photo handed over by another flow (e.g. identify's no-match fallback); skips capture and enters at the pre-send review. */
  initialImage?: string;
  /** Context note carried over alongside `initialImage`. */
  initialNote?: string;
}

/**
 * Full flow for "AI analyze": photograph a dish, get an AI estimate via
 * the analyze-food Edge Function, optionally refine it with corrections, and
 * accept it into the add-entry prefill flow as a one-serving search result.
 */
export function AiAnalyzeOverlay({
  onAccept,
  onCancel,
  fallback,
  initialImage,
  initialNote,
}: AiAnalyzeOverlayProps) {
  const [phase, setPhase] = useState<Phase>(
    initialImage ? { kind: 'confirming' } : { kind: 'capturing' },
  );
  const [image, setImage] = useState<string | null>(initialImage ?? null);
  /** Optional context note typed on the pre-send review step; sent as the first correction. */
  const [note, setNote] = useState(initialNote ?? '');
  /** Corrections the model has successfully incorporated, oldest first (the note, once sent, is corrections[0]). */
  const [corrections, setCorrections] = useState<string[]>([]);
  const [correctionInput, setCorrectionInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // The capture and confirm steps are their own layers and register their own
  // handlers, so this one stands down for them rather than racing to be the
  // topmost when both mount in the same commit — which is exactly what happens
  // when the overlay opens straight into confirming with a handed-over photo.
  useBackHandler(
    !(phase.kind === 'capturing' || (phase.kind === 'confirming' && !!image)),
    onCancel,
  );

  /**
   * One analysis turn. `correction` distinguishes a refinement (whose failure
   * keeps `prior` usable) from the initial analysis; it only joins the
   * committed corrections once the model has answered for it.
   */
  async function analyze(img: string, correction?: string, prior?: FoodEstimate) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase(correction && prior ? { kind: 'refining', estimate: prior } : { kind: 'analyzing' });
    try {
      const estimate = await analyzeFood(
        { image: img, corrections: correction ? [...corrections, correction] : corrections },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (correction) {
        setCorrections((prev) => [...prev, correction]);
        setCorrectionInput('');
      }
      setPhase({ kind: 'review', estimate });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setPhase(
        correction && prior
          ? { kind: 'refine-error', estimate: prior, message, failedCorrection: correction }
          : { kind: 'analyze-error', message },
      );
    }
  }

  function handleRefine(e: FormEvent, estimate: FoodEstimate) {
    e.preventDefault();
    const correction = correctionInput.trim();
    if (!correction || !image) return;
    void analyze(image, correction, estimate);
  }

  function handleRetake() {
    setImage(null);
    setPhase({ kind: 'capturing' });
  }

  function handleSend() {
    if (!image) return;
    void analyze(image, note.trim() || undefined);
  }

  if (phase.kind === 'capturing') {
    return (
      <PhotoCapture
        onCapture={(img) => {
          setImage(img);
          setPhase({ kind: 'confirming' });
        }}
        onCancel={onCancel}
        fallback={fallback}
      />
    );
  }

  if (phase.kind === 'confirming' && image) {
    return (
      <PhotoConfirm
        image={image}
        note={note}
        onNoteChange={setNote}
        onRetake={handleRetake}
        onSend={handleSend}
        onCancel={onCancel}
        sendLabel="Analyze"
      />
    );
  }

  const estimate =
    phase.kind === 'review' || phase.kind === 'refining' || phase.kind === 'refine-error'
      ? phase.estimate
      : null;
  const busy = phase.kind === 'analyzing' || phase.kind === 'refining';

  return (
    <div className="scanner-overlay" role="dialog" aria-label="AI food analysis">
      <div className="ai-review">
        {image && <img src={image} alt="Captured food" className="ai-photo" />}

        {phase.kind === 'analyzing' && <p className="loading">Analyzing your photo…</p>}

        {phase.kind === 'analyze-error' && (
          <div className="scanner-error" role="alert">
            <p>The photo couldn’t be analyzed ({phase.message}).</p>
            <p>
              <button
                type="button"
                className="link-button"
                onClick={() => image && void analyze(image, note.trim() || undefined)}
              >
                Retry
              </button>
            </p>
            {fallback}
          </div>
        )}

        {estimate && (
          <>
            <div className="ai-estimate">
              <p className="ai-estimate-label">AI estimate — check before saving</p>
              <p className="ai-estimate-name">{estimate.name}</p>
              <p className="ai-estimate-macros">
                {estimate.calories} kcal · F {estimate.fat} g · C {estimate.carbs} g · P{' '}
                {estimate.protein} g
              </p>
              {estimate.confidenceNote && (
                <p className="ai-estimate-note">{estimate.confidenceNote}</p>
              )}
            </div>

            {phase.kind === 'refining' && <p className="loading">Updating the estimate…</p>}

            {phase.kind === 'refine-error' && (
              <div className="scanner-error" role="alert">
                <p>That correction couldn’t be processed ({phase.message}).</p>
                <p>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      image && void analyze(image, phase.failedCorrection, phase.estimate)
                    }
                  >
                    Retry
                  </button>{' '}
                  or accept the estimate above as-is.
                </p>
              </div>
            )}

            <form className="ai-refine" onSubmit={(e) => handleRefine(e, estimate)}>
              <label htmlFor="ai-correction" className="ai-refine-label">
                Doesn’t look right? Tell the AI what it missed.
              </label>
              <div className="ai-refine-row">
                <ClearableInput
                  id="ai-correction"
                  value={correctionInput}
                  onChange={(e) => setCorrectionInput(e.target.value)}
                  placeholder="e.g. there’s rice under it too"
                  disabled={busy}
                  clearLabel="Clear correction"
                />
                <button type="submit" className="secondary" disabled={busy || !correctionInput.trim()}>
                  Ask again
                </button>
              </div>
            </form>

            <button
              type="button"
              className="ai-accept"
              disabled={busy}
              onClick={() => image && onAccept(mapEstimateToResult(estimate), image)}
            >
              Use this estimate
            </button>
          </>
        )}
      </div>

      <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
