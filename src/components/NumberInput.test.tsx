import { act, fireEvent, render, screen } from '@testing-library/react';
import { NumberInput } from './NumberInput';

function mockPointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)' ? coarse : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function focusField() {
  fireEvent.focus(screen.getByLabelText('Calories'));
  // the select is deferred past the tap's caret placement
  act(() => vi.advanceTimersByTime(0));
  return screen.getByLabelText('Calories') as HTMLInputElement;
}

describe('NumberInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks for the numeric keypad', () => {
    render(<NumberInput value="450" onChange={() => {}} aria-label="Calories" />);
    expect(screen.getByLabelText('Calories')).toHaveAttribute('inputmode', 'decimal');
  });

  it('selects the existing value on focus on a touch device', () => {
    mockPointer(true);
    render(<NumberInput value="450" onChange={() => {}} aria-label="Calories" />);

    const input = focusField();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(3);
  });

  it('leaves the caret alone on a mouse pointer', () => {
    mockPointer(false);
    render(<NumberInput value="450" onChange={() => {}} aria-label="Calories" />);

    const input = focusField();
    // caret collapsed at the end rather than a selection over the value
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });
});
