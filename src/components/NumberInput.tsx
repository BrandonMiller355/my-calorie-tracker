import { forwardRef, type ComponentPropsWithoutRef, type FocusEvent } from 'react';

/**
 * A numeric field: asks mobile keyboards for the calculator-style keypad, and
 * on touch devices selects what's already there so a tap-and-type replaces the
 * number instead of appending to it. Renders a plain <input> — no wrapper.
 */
export const NumberInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(
  function NumberInput(props, ref) {
    return <input ref={ref} inputMode="decimal" onFocus={selectExistingValue} {...props} />;
  },
);

function selectExistingValue(e: FocusEvent<HTMLInputElement>) {
  // Only on touch: on a mouse, clicking into a number usually means "edit here".
  if (!window.matchMedia?.('(pointer: coarse)').matches) return;
  const input = e.currentTarget;
  if (input.value === '') return;
  // iOS places the caret from the tap after this handler runs, so wait it out.
  setTimeout(() => input.select(), 0);
}
