import { useRef, type ComponentPropsWithoutRef } from 'react';

/**
 * Clears a field by driving the DOM directly, so the field's own onChange fires
 * exactly as it would if the text had been deleted by hand. React tracks the
 * last value on the node itself, so going through the prototype setter is what
 * makes it see a real change.
 */
function clearNatively(node: HTMLInputElement | HTMLTextAreaElement) {
  const proto =
    node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(node, '');
  node.dispatchEvent(new Event('input', { bubbles: true }));
  node.focus();
}

function ClearButton({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <button
      type="button"
      className="input-clear"
      // The name lives in text rather than aria-label so a field-name lookup
      // (getByLabelText, and the a11y tree) still resolves to the field itself.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClear}
    >
      <span aria-hidden="true">✕</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'value'> & {
  value: string;
  /** Accessible name for the clear button, e.g. "Clear calories". */
  clearLabel?: string;
};

export function ClearableInput({ value, clearLabel = 'Clear', ...rest }: InputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const showClear = value !== '' && !rest.disabled && !rest.readOnly;

  return (
    <span className="clearable-input">
      <input ref={ref} value={value} {...rest} />
      {showClear && (
        <ClearButton label={clearLabel} onClear={() => ref.current && clearNatively(ref.current)} />
      )}
    </span>
  );
}

type TextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'value'> & {
  value: string;
  clearLabel?: string;
};

export function ClearableTextarea({ value, clearLabel = 'Clear', ...rest }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const showClear = value !== '' && !rest.disabled && !rest.readOnly;

  return (
    <span className="clearable-input clearable-textarea">
      <textarea ref={ref} value={value} {...rest} />
      {showClear && (
        <ClearButton label={clearLabel} onClear={() => ref.current && clearNatively(ref.current)} />
      )}
    </span>
  );
}
