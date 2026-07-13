import type { ReactNode } from 'react';
import type { Totals } from '../lib/totals';
import type { Goals } from '../types';

const MACROS = [
  { key: 'fat', label: 'Fat' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'protein', label: 'Protein' },
] as const;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fillPercent(consumed: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, (consumed / goal) * 100);
}

export function Summary({
  totals,
  goals,
  goalsAreDefault,
  footer,
}: {
  totals: Totals;
  goals: Goals;
  goalsAreDefault: boolean;
  /** Rendered in the hero card's footer row (the per-day goal editor) */
  footer?: ReactNode;
}) {
  const calRemaining = round1(goals.calories - totals.calories);
  const calOver = calRemaining < 0;

  return (
    <section className="summary" aria-label="Daily summary">
      <div className={`summary-card summary-hero${calOver ? ' over-bad' : ''}`}>
        <div className="hero-top">
          <div className="hero-remaining">
            <span className="sr-only">
              {calOver
                ? `Over by ${Math.abs(calRemaining)} kcal`
                : `${calRemaining} kcal left`}
            </span>
            <span className="hero-remaining-num" aria-hidden="true">
              {Math.abs(calRemaining)}
            </span>
            <span className="hero-remaining-label" aria-hidden="true">
              {calOver ? 'kcal over' : 'kcal left'}
            </span>
          </div>
          <div className="hero-of">
            {totals.calories} of {goals.calories}
          </div>
        </div>
        <div className="bar bar-hero">
          <div
            className={`bar-fill${calOver ? ' bar-fill-bad' : ''}`}
            style={{ width: `${fillPercent(totals.calories, goals.calories)}%` }}
          />
        </div>
        {(goalsAreDefault || footer) && (
          <div className="hero-footer">
            {goalsAreDefault && (
              <p className="summary-note">Using default goals — set your own in Settings.</p>
            )}
            {footer}
          </div>
        )}
      </div>

      <div className="summary-macros">
        {MACROS.map(({ key, label }) => {
          const remaining = round1(goals[key] - totals[key]);
          const over = remaining < 0;
          return (
            <div key={key} className={`summary-card macro-card${over ? ' over-good' : ''}`}>
              <div className="macro-label">{label}</div>
              <div className="macro-amount">
                {totals[key]}
                <span className="macro-goal"> / {goals[key]} g</span>
              </div>
              <div className="bar bar-macro">
                <div
                  className={`bar-fill${over ? ' bar-fill-good' : ''}`}
                  style={{ width: `${fillPercent(totals[key], goals[key])}%` }}
                />
              </div>
              <div className={`macro-delta${over ? ' macro-delta-over' : ''}`}>
                {over ? `Over by ${Math.abs(remaining)} g` : `${remaining} g left`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
