import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BackNavigationProvider, EXIT_HINT, EXIT_WINDOW_MS, useBackHandler } from './BackNavigation';

/** The platform back signal, as the browser delivers it. */
function pressBack() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

function pressEscape() {
  act(() => {
    fireEvent.keyDown(window, { key: 'Escape' });
  });
}

/** A stand-in layer: registers while open, closes when back reaches it. */
function Layer({ name, onDismiss }: { name: string; onDismiss?: () => void }) {
  const [open, setOpen] = useState(true);
  useBackHandler(open, () => {
    setOpen(false);
    onDismiss?.();
  });
  return <p>{open ? `${name} open` : `${name} closed`}</p>;
}

function CurrentPath() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderApp(ui: React.ReactNode, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BackNavigationProvider>
        <CurrentPath />
        <Routes>
          <Route path="*" element={<>{ui}</>} />
        </Routes>
      </BackNavigationProvider>
    </MemoryRouter>,
  );
}

describe('back handler stack', () => {
  it('dismisses the most recently registered layer first', () => {
    renderApp(
      <>
        <Layer name="form" />
        <Layer name="photo" />
      </>,
    );

    pressBack();
    expect(screen.getByText('photo closed')).toBeInTheDocument();
    expect(screen.getByText('form open')).toBeInTheDocument();

    pressBack();
    expect(screen.getByText('form closed')).toBeInTheDocument();
  });

  it('stops calling a handler once its layer has closed', () => {
    const onDismiss = vi.fn();
    renderApp(<Layer name="form" onDismiss={onDismiss} />);

    pressBack();
    pressBack();
    pressBack();

    // Only the press that found it open counted; the rest fell through
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('leaves the screen behind a dismissed layer alone', () => {
    renderApp(<Layer name="editor" />, ['/foods']);

    pressBack();

    expect(screen.getByText('editor closed')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/foods');
  });
});

describe('back beyond the layers', () => {
  it('returns to the Log tab from another tab', () => {
    renderApp(<p>foods</p>, ['/foods']);

    pressBack();

    expect(screen.getByTestId('path')).toHaveTextContent('/');
  });

  it('takes the layer first and the tab only once it is closed', () => {
    renderApp(<Layer name="editor" />, ['/foods']);

    pressBack();
    expect(screen.getByTestId('path')).toHaveTextContent('/foods');

    pressBack();
    expect(screen.getByTestId('path')).toHaveTextContent('/');
  });
});

describe('exit guard', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('warns instead of exiting when there is nothing left to unwind', () => {
    renderApp(<p>log</p>);

    pressBack();

    const hint = screen.getByRole('status');
    expect(hint).toHaveTextContent(EXIT_HINT);
    expect(hint).toHaveAttribute('aria-live', 'polite');
  });

  it('clears the hint once the window lapses', () => {
    renderApp(<p>log</p>);

    pressBack();
    act(() => vi.advanceTimersByTime(EXIT_WINDOW_MS));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('re-arms after the window lapses instead of exiting silently', () => {
    renderApp(<p>log</p>);

    pressBack();
    act(() => vi.advanceTimersByTime(EXIT_WINDOW_MS));
    pressBack();

    // The hint is showing again, so the second press warned rather than left
    expect(screen.getByRole('status')).toHaveTextContent(EXIT_HINT);
  });

  it('drops an armed exit when a layer opens, so back dismisses it instead', () => {
    function Late() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          {open && <Layer name="sheet" />}
        </>
      );
    }
    renderApp(<Late />);

    pressBack();
    expect(screen.getByRole('status')).toHaveTextContent(EXIT_HINT);

    fireEvent.click(screen.getByText('open'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    pressBack();
    expect(screen.getByText('sheet closed')).toBeInTheDocument();
  });

  it('does not arm while a layer, another tab, or a past day still has a step', () => {
    renderApp(<Layer name="form" />, ['/foods']);

    pressBack();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    pressBack();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('escape', () => {
  it('dismisses the topmost layer, like back', () => {
    renderApp(
      <>
        <Layer name="form" />
        <Layer name="photo" />
      </>,
    );

    pressEscape();

    expect(screen.getByText('photo closed')).toBeInTheDocument();
    expect(screen.getByText('form open')).toBeInTheDocument();
  });

  it('stops at the layers: no tab change, no exit hint', () => {
    renderApp(<p>foods</p>, ['/foods']);

    pressEscape();
    pressEscape();

    expect(screen.getByTestId('path')).toHaveTextContent('/foods');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
