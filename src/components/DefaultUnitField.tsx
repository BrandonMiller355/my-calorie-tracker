import { defaultPortion, measureUnitsFor, resolveDefaultUnit, UNIT_LABELS, unitLabel } from '../lib/units';
import type { ServingAnchor } from '../types';

/**
 * Picks the unit a food's logging starts in: its count label ('') or a unit of
 * its equivalence's dimension — the same choices its log form's unit picker
 * offers. The options follow `anchor` as the serving definition is edited; a
 * pick the anchor stops offering shows, and so saves, as the count label.
 */
export function DefaultUnitField({
  anchor,
  value,
  onChange,
}: {
  /** Live parse of the serving definition fields this sits under */
  anchor: ServingAnchor;
  /** A MeasureUnit, or '' for the count label */
  value: string;
  onChange: (value: string) => void;
}) {
  const units = measureUnitsFor(anchor);
  const shown = resolveDefaultUnit(value, anchor);
  const start = shown && defaultPortion({ ...anchor, defaultUnit: shown });

  return (
    <>
      <div className="serving-def-row serving-def-default">
        <label>
          Default log unit
          <select
            value={shown ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={units.length === 0}
          >
            <option value="">{anchor.servingLabel}</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {units.length === 0 ? (
        <p className="form-note">Fill in “Equals” to log this food by weight or volume.</p>
      ) : (
        start && (
          <p className="form-note">
            Logging starts at {start.amount} {unitLabel(start.unit)}, ready to type over.
          </p>
        )
      )}
    </>
  );
}
