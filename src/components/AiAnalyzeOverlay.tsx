import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { analyzeFood, mapEstimateToResult, type FoodEstimate } from '../api/analyzeFood';
import type { FoodSearchResult } from '../types';
import { PhotoCapture } from './PhotoCapture';

// The whole conversation — photo, corrections, estimates — lives in this
// component's state and dies with it. Nothing here is persisted anywhere.
type Phase =
  | { kind: 'capturing' }
  | { kind: 'analyzing' }
  | { kind: 'review'; estimate: FoodEstimate }
  | { kind: 'refining'; estimate: FoodEstimate }
  /** Initial analysis failed; retry re-analyzes the same photo. */
  | { kind: 'analyze-error'; message: string }
  /** A refinement failed; the prior estimate stays usable and the correction can be retried. */
  | { kind: 'refine-error'; estimate: FoodEstimate; message: string; failedCorrection: string };

interface AiAnalyzeOverlayProps {
  onAccept: (result: FoodSearchResult) => void;
  onCancel: () => void;
  /** Rendered under camera/analysis errors (e.g. a manual-entry link). */
  fallback?: ReactNode;
}

/**
 * Full flow for "AI analyze": photograph a dish, get an AI estimate via
 * the analyze-food Edge Function, optionally refine it with corrections, and
 * accept it into the add-entry prefill flow as a one-serving search result.
 */
export function AiAnalyzeOverlay({ onAccept, onCancel, fallback }: AiAnalyzeOverlayProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'capturing' });
  const [image, setImage] = useState<string | null>(null);
  /** Corrections the model has successfully incorporated, oldest first. */
  const [corrections, setCorrections] = useState<string[]>([]);
  const [correctionInput, setCorrectionInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

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

  if (phase.kind === 'capturing') {
    return (
      <PhotoCapture
        onCapture={(img) => {
          setImage(img);
          void analyze(img);
        }}
        onCancel={onCancel}
        fallback={fallback}
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
                onClick={() => image && void analyze(image)}
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
                <input
                  id="ai-correction"
                  value={correctionInput}
                  onChange={(e) => setCorrectionInput(e.target.value)}
                  placeholder="e.g. there’s rice under it too"
                  disabled={busy}
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
              onClick={() => onAccept(mapEstimateToResult(estimate))}
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
