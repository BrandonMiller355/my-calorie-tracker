import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { LibraryFood } from '../types';

export interface ComboboxGroup {
  label: string;
  foods: LibraryFood[];
}

export interface ComboboxAction {
  id: string;
  label: string;
  onSelect: () => void;
}

export interface FoodNameComboboxProps {
  /** id for the input so an external <label htmlFor> can reference it */
  inputId?: string;
  value: string;
  onChange: (value: string) => void;
  /** Suggestion groups when the input is empty, library matches when typing */
  groups: ComboboxGroup[];
  /** Fixed footer rows, e.g. search online / use as new food */
  actions: ComboboxAction[];
  onSelectFood: (food: LibraryFood) => void;
  /** Focus the input on mount (opens the dropdown and, on mobile, the keyboard) */
  autoFocus?: boolean;
}

type Option = { kind: 'food'; food: LibraryFood } | { kind: 'action'; action: ComboboxAction };

/**
 * Minimal ARIA combobox for the entry form's Name field. Free text is always
 * valid: with no option highlighted, Enter falls through to form submit.
 */
export function FoodNameCombobox({
  inputId,
  value,
  onChange,
  groups,
  actions,
  onSelectFood,
  autoFocus = true,
}: FoodNameComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const options: Option[] = [
    ...groups.flatMap((g) => g.foods.map((food): Option => ({ kind: 'food', food }))),
    ...actions.map((action): Option => ({ kind: 'action', action })),
  ];
  const expanded = open && options.length > 0;

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function select(option: Option) {
    if (option.kind === 'food') onSelectFood(option.food);
    else option.action.onSelect();
    close();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!expanded) {
      if (e.key === 'ArrowDown' && options.length > 0) {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          e.preventDefault();
          select(options[activeIndex]);
        }
        break;
      case 'Escape':
        close();
        break;
    }
  }

  // Options must be flattened for aria-activedescendant/keyboard order, but
  // are rendered per group so each section keeps its label.
  let optionIndex = -1;
  const optionId = (i: number) => `${listId}-option-${i}`;

  function renderOption(option: Option) {
    optionIndex += 1;
    const i = optionIndex;
    return (
      <li
        key={option.kind === 'food' ? option.food.id : option.action.id}
        id={optionId(i)}
        role="option"
        aria-selected={i === activeIndex}
        // the list scrolls; keep the keyboard-highlighted option visible
        // (optional call: jsdom has no scrollIntoView)
        ref={i === activeIndex ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : undefined}
        className={`combobox-option${option.kind === 'action' ? ' combobox-action' : ''}${
          i === activeIndex ? ' active' : ''
        }`}
        // preventDefault keeps focus on the input so blur doesn't swallow the click
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          select(option);
          // Tap-selecting is done with the field; drop focus so the on-screen
          // keyboard dismisses. (Enter-selection keeps focus for keyboard flow.)
          inputRef.current?.blur();
        }}
      >
        {option.kind === 'food' ? (
          <>
            <span className="combobox-option-name">
              {option.food.name}
              <span className="combobox-option-kcal"> · {option.food.calories} kcal</span>
            </span>
            {option.food.description && (
              <span className="combobox-option-desc">{option.food.description}</span>
            )}
          </>
        ) : (
          option.action.label
        )}
      </li>
    );
  }

  return (
    <div className="combobox">
      <input
        id={inputId}
        ref={inputRef}
        value={value}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
      />
      {value !== '' && (
        <button
          type="button"
          className="combobox-clear"
          aria-label="Clear name"
          // preventDefault keeps focus on the input so blur doesn't swallow the click
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('');
            setOpen(true);
            setActiveIndex(-1);
            inputRef.current?.focus();
          }}
        >
          ✕
        </button>
      )}
      {expanded && (
        <ul className="combobox-list" id={listId} role="listbox">
          {groups
            .filter((g) => g.foods.length > 0)
            .map((group) => (
              <li key={group.label} role="presentation">
                <span className="combobox-group-label">{group.label}</span>
                <ul role="presentation">{group.foods.map((food) => renderOption({ kind: 'food', food }))}</ul>
              </li>
            ))}
          {actions.map((action) => renderOption({ kind: 'action', action }))}
        </ul>
      )}
    </div>
  );
}
