import { fireEvent, render, screen } from '@testing-library/react';
import { IdentifyOverlay } from './IdentifyOverlay';
import type { LibraryFood } from '../types';

const identifyFoodMock = vi.hoisted(() => vi.fn());

vi.mock('../api/identifyFood', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/identifyFood')>()),
  identifyFood: identifyFoodMock,
}));

// The camera is untestable in jsdom; the stub exposes capture/cancel directly.
vi.mock('./PhotoCapture', () => ({
  PhotoCapture: ({
    onCapture,
    onCancel,
  }: {
    onCapture: (img: string) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button onClick={() => onCapture('data:image/jpeg;base64,test')}>stub-capture</button>
      <button onClick={onCancel}>stub-cancel</button>
    </div>
  ),
}));

const CHICKEN: LibraryFood = {
  id: 'food-chicken',
  name: 'Chicken breast',
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
  calories: 165,
  carbs: 0,
  protein: 31,
  fat: 4,
  source: 'manual',
};

const PORK: LibraryFood = {
  id: 'food-pork',
  name: 'Pork chop',
  description: 'boneless, trimmed',
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
  calories: 197,
  carbs: 0,
  protein: 27,
  fat: 9,
  source: 'manual',
};

const FOODS = [CHICKEN, PORK];

function capture() {
  fireEvent.click(screen.getByText('stub-capture'));
}

function send() {
  fireEvent.click(screen.getByText('Identify'));
}

describe('IdentifyOverlay', () => {
  beforeEach(() => {
    identifyFoodMock.mockReset();
  });

  it('sends nothing until the pre-send review is confirmed', () => {
    render(
      <IdentifyOverlay foods={FOODS} onMatch={() => {}} onEstimateFallback={() => {}} onCancel={() => {}} />,
    );

    capture();

    expect(screen.getByText('Retake')).toBeInTheDocument();
    expect(identifyFoodMock).not.toHaveBeenCalled();
  });

  it('sends the photo, note, and non-archived foods on Identify', async () => {
    identifyFoodMock.mockResolvedValue({ candidates: [{ id: CHICKEN.id, confidence: 0.9 }] });
    const onMatch = vi.fn();
    render(
      <IdentifyOverlay
        foods={[...FOODS, { ...CHICKEN, id: 'archived', name: 'Old', archivedAt: '2026-01-01T00:00:00Z' }]}
        onMatch={onMatch}
        onEstimateFallback={() => {}}
        onCancel={() => {}}
      />,
    );

    capture();
    fireEvent.change(screen.getByLabelText(/Add context for the AI/), {
      target: { value: 'the bowl is tared' },
    });
    send();

    await vi.waitFor(() => expect(onMatch).toHaveBeenCalled());
    const request = identifyFoodMock.mock.calls[0][0];
    expect(request.image).toBe('data:image/jpeg;base64,test');
    expect(request.note).toBe('the bowl is tared');
    expect(request.foods.map((f: { id: string }) => f.id)).toEqual([CHICKEN.id, PORK.id]);
  });

  it('resolves a single candidate immediately with the returned amount', async () => {
    identifyFoodMock.mockResolvedValue({
      candidates: [{ id: CHICKEN.id, confidence: 0.92 }],
      amount: { grams: 142, source: 'scale' },
    });
    const onMatch = vi.fn();
    render(
      <IdentifyOverlay foods={FOODS} onMatch={onMatch} onEstimateFallback={() => {}} onCancel={() => {}} />,
    );

    capture();
    send();

    await vi.waitFor(() => expect(onMatch).toHaveBeenCalledTimes(1));
    expect(onMatch).toHaveBeenCalledWith(CHICKEN, { grams: 142, source: 'scale' });
  });

  it('shows a chooser for multiple candidates and resolves the picked one', async () => {
    identifyFoodMock.mockResolvedValue({
      candidates: [
        { id: CHICKEN.id, confidence: 0.5 },
        { id: PORK.id, confidence: 0.45 },
      ],
      amount: { grams: 130, source: 'estimate' },
    });
    const onMatch = vi.fn();
    render(
      <IdentifyOverlay foods={FOODS} onMatch={onMatch} onEstimateFallback={() => {}} onCancel={() => {}} />,
    );

    capture();
    send();

    await screen.findByText('Which of these is it?');
    expect(screen.getByText('Chicken breast')).toBeInTheDocument();
    expect(screen.getByText('boneless, trimmed')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pork chop'));

    expect(onMatch).toHaveBeenCalledWith(PORK, { grams: 130, source: 'estimate' });
  });

  it('dismissing the chooser cancels without a match', async () => {
    identifyFoodMock.mockResolvedValue({
      candidates: [
        { id: CHICKEN.id, confidence: 0.5 },
        { id: PORK.id, confidence: 0.45 },
      ],
    });
    const onMatch = vi.fn();
    const onCancel = vi.fn();
    render(
      <IdentifyOverlay foods={FOODS} onMatch={onMatch} onEstimateFallback={() => {}} onCancel={onCancel} />,
    );

    capture();
    send();
    await screen.findByText('Which of these is it?');

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('offers the estimate fallback on no match and hands over the photo and note', async () => {
    identifyFoodMock.mockResolvedValue({ candidates: [] });
    const onEstimateFallback = vi.fn();
    render(
      <IdentifyOverlay
        foods={FOODS}
        onMatch={() => {}}
        onEstimateFallback={onEstimateFallback}
        onCancel={() => {}}
      />,
    );

    capture();
    fireEvent.change(screen.getByLabelText(/Add context for the AI/), {
      target: { value: 'cooked weight' },
    });
    send();

    await screen.findByText(/doesn’t look like anything in your food library/);
    fireEvent.click(screen.getByText('Get an AI estimate instead'));

    expect(onEstimateFallback).toHaveBeenCalledWith('data:image/jpeg;base64,test', 'cooked weight');
  });

  it('declining the fallback returns to the form untouched', async () => {
    identifyFoodMock.mockResolvedValue({ candidates: [] });
    const onCancel = vi.fn();
    const onEstimateFallback = vi.fn();
    render(
      <IdentifyOverlay
        foods={FOODS}
        onMatch={() => {}}
        onEstimateFallback={onEstimateFallback}
        onCancel={onCancel}
      />,
    );

    capture();
    send();
    await screen.findByText(/doesn’t look like anything in your food library/);

    fireEvent.click(screen.getByText('Back to form'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEstimateFallback).not.toHaveBeenCalled();
  });

  it('skips the request entirely when the library is empty', async () => {
    render(
      <IdentifyOverlay foods={[]} onMatch={() => {}} onEstimateFallback={() => {}} onCancel={() => {}} />,
    );

    capture();
    send();

    await screen.findByText(/doesn’t look like anything in your food library/);
    expect(identifyFoodMock).not.toHaveBeenCalled();
  });

  it('shows a retryable error when identification fails', async () => {
    identifyFoodMock.mockRejectedValue(new Error('service down'));
    const onMatch = vi.fn();
    render(
      <IdentifyOverlay foods={FOODS} onMatch={onMatch} onEstimateFallback={() => {}} onCancel={() => {}} />,
    );

    capture();
    send();
    await screen.findByText(/The photo couldn’t be identified \(service down\)/);

    identifyFoodMock.mockResolvedValue({ candidates: [{ id: CHICKEN.id, confidence: 0.9 }] });
    fireEvent.click(screen.getByText('Retry'));

    await vi.waitFor(() => expect(onMatch).toHaveBeenCalledWith(CHICKEN, undefined));
    expect(identifyFoodMock).toHaveBeenCalledTimes(2);
  });

  it('cancel from capture and from the pre-send review both call onCancel without sending', () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <IdentifyOverlay foods={FOODS} onMatch={() => {}} onEstimateFallback={() => {}} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByText('stub-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    render(
      <IdentifyOverlay foods={FOODS} onMatch={() => {}} onEstimateFallback={() => {}} onCancel={onCancel} />,
    );
    capture();
    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(identifyFoodMock).not.toHaveBeenCalled();
  });
});
