import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiAnalyzeOverlay } from './AiAnalyzeOverlay';
import type { FoodEstimate } from '../api/analyzeFood';

const analyzeFoodMock = vi.hoisted(() => vi.fn());

vi.mock('../api/analyzeFood', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/analyzeFood')>()),
  analyzeFood: analyzeFoodMock,
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

const ESTIMATE: FoodEstimate = {
  name: 'Chicken and rice',
  calories: 550,
  fat: 12,
  carbs: 60,
  protein: 45,
  confidenceNote: 'Assumed about 1 cup of rice.',
};

const REVISED: FoodEstimate = {
  name: 'Chicken, rice, and beans',
  calories: 700,
  fat: 14,
  carbs: 85,
  protein: 52,
  confidenceNote: 'Assumed a half cup of beans.',
};

function capture() {
  fireEvent.click(screen.getByText('stub-capture'));
}

function send() {
  fireEvent.click(screen.getByText('Analyze'));
}

async function captureAndAnalyze() {
  capture();
  send();
  await screen.findByText('Chicken and rice');
}

describe('AiAnalyzeOverlay', () => {
  beforeEach(() => {
    analyzeFoodMock.mockReset();
    analyzeFoodMock.mockResolvedValue(ESTIMATE);
  });

  it('analyzes the captured photo and shows the labeled estimate', async () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);

    await captureAndAnalyze();

    expect(analyzeFoodMock).toHaveBeenCalledWith(
      { image: 'data:image/jpeg;base64,test', corrections: [] },
      expect.anything(),
    );
    expect(screen.getByText(/AI estimate — check before saving/)).toBeInTheDocument();
    expect(screen.getByText(/550 kcal/)).toBeInTheDocument();
    expect(screen.getByText('Assumed about 1 cup of rice.')).toBeInTheDocument();
  });

  it('sends corrections with the same photo and replaces the estimate', async () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);
    await captureAndAnalyze();

    analyzeFoodMock.mockResolvedValue(REVISED);
    fireEvent.change(screen.getByLabelText(/Tell the AI what it missed/), {
      target: { value: 'there are beans too' },
    });
    fireEvent.click(screen.getByText('Ask again'));

    await screen.findByText('Chicken, rice, and beans');
    expect(screen.queryByText('Chicken and rice')).not.toBeInTheDocument();
    expect(analyzeFoodMock).toHaveBeenLastCalledWith(
      { image: 'data:image/jpeg;base64,test', corrections: ['there are beans too'] },
      expect.anything(),
    );
  });

  it('accumulates corrections across turns', async () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);
    await captureAndAnalyze();

    const input = screen.getByLabelText(/Tell the AI what it missed/);
    analyzeFoodMock.mockResolvedValue(REVISED);
    fireEvent.change(input, { target: { value: 'there are beans too' } });
    fireEvent.click(screen.getByText('Ask again'));
    await screen.findByText('Chicken, rice, and beans');

    fireEvent.change(input, { target: { value: 'the bowl is small' } });
    fireEvent.click(screen.getByText('Ask again'));

    await waitFor(() =>
      expect(analyzeFoodMock).toHaveBeenLastCalledWith(
        {
          image: 'data:image/jpeg;base64,test',
          corrections: ['there are beans too', 'the bowl is small'],
        },
        expect.anything(),
      ),
    );
  });

  it('keeps the prior estimate on a refinement failure and retries the same correction', async () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);
    await captureAndAnalyze();

    analyzeFoodMock.mockRejectedValue(new Error('service down'));
    fireEvent.change(screen.getByLabelText(/Tell the AI what it missed/), {
      target: { value: 'there are beans too' },
    });
    fireEvent.click(screen.getByText('Ask again'));

    await screen.findByText(/That correction couldn’t be processed \(service down\)/);
    expect(screen.getByText('Chicken and rice')).toBeInTheDocument();

    analyzeFoodMock.mockResolvedValue(REVISED);
    fireEvent.click(screen.getByText('Retry'));

    await screen.findByText('Chicken, rice, and beans');
    expect(analyzeFoodMock).toHaveBeenLastCalledWith(
      { image: 'data:image/jpeg;base64,test', corrections: ['there are beans too'] },
      expect.anything(),
    );
  });

  it('shows a retryable error when the initial analysis fails', async () => {
    analyzeFoodMock.mockRejectedValue(new Error('service down'));
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);

    capture();
    send();
    await screen.findByText(/The photo couldn’t be analyzed \(service down\)/);

    analyzeFoodMock.mockResolvedValue(ESTIMATE);
    fireEvent.click(screen.getByText('Retry'));

    await screen.findByText('Chicken and rice');
    expect(analyzeFoodMock).toHaveBeenLastCalledWith(
      { image: 'data:image/jpeg;base64,test', corrections: [] },
      expect.anything(),
    );
  });

  it('accepting hands a one-serving search result to onAccept', async () => {
    const onAccept = vi.fn();
    render(<AiAnalyzeOverlay onAccept={onAccept} onCancel={() => {}} />);
    await captureAndAnalyze();

    fireEvent.click(screen.getByText('Use this estimate'));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0]).toMatchObject({
      name: 'Chicken and rice',
      servingLabel: 'serving',
      calories: 550,
      fat: 12,
      carbs: 60,
      protein: 45,
    });
    expect(onAccept.mock.calls[0][0].servingSize).toBeUndefined();
  });

  it('cancel from capture and from the estimate review both call onCancel', async () => {
    const onCancel = vi.fn();
    const { unmount } = render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('stub-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={onCancel} />);
    await captureAndAnalyze();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('cancel from the pre-send review step calls onCancel and sends nothing', () => {
    const onCancel = vi.fn();
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={onCancel} />);

    capture();
    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(analyzeFoodMock).not.toHaveBeenCalled();
  });

  it('retake discards the photo, reopens the camera, and preserves the note', () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);

    capture();
    fireEvent.change(screen.getByLabelText(/Add context for the AI/), {
      target: { value: "I didn't eat the ranch" },
    });
    fireEvent.click(screen.getByText('Retake'));

    expect(screen.getByText('stub-capture')).toBeInTheDocument();

    capture();
    expect(screen.getByLabelText(/Add context for the AI/)).toHaveValue("I didn't eat the ranch");
    expect(analyzeFoodMock).not.toHaveBeenCalled();
  });

  it('sends the context note as the first correction', async () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);

    capture();
    fireEvent.change(screen.getByLabelText(/Add context for the AI/), {
      target: { value: "I didn't eat the ranch" },
    });
    send();

    await screen.findByText('Chicken and rice');
    expect(analyzeFoodMock).toHaveBeenCalledWith(
      { image: 'data:image/jpeg;base64,test', corrections: ["I didn't eat the ranch"] },
      expect.anything(),
    );
  });

  it('sends with no corrections when the note is left blank', async () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);

    await captureAndAnalyze();

    expect(analyzeFoodMock).toHaveBeenCalledWith(
      { image: 'data:image/jpeg;base64,test', corrections: [] },
      expect.anything(),
    );
  });

  it('applies later refinements after the note', async () => {
    render(<AiAnalyzeOverlay onAccept={() => {}} onCancel={() => {}} />);

    capture();
    fireEvent.change(screen.getByLabelText(/Add context for the AI/), {
      target: { value: "I didn't eat the ranch" },
    });
    send();
    await screen.findByText('Chicken and rice');

    analyzeFoodMock.mockResolvedValue(REVISED);
    fireEvent.change(screen.getByLabelText(/Tell the AI what it missed/), {
      target: { value: 'there are beans too' },
    });
    fireEvent.click(screen.getByText('Ask again'));

    await screen.findByText('Chicken, rice, and beans');
    expect(analyzeFoodMock).toHaveBeenLastCalledWith(
      {
        image: 'data:image/jpeg;base64,test',
        corrections: ["I didn't eat the ranch", 'there are beans too'],
      },
      expect.anything(),
    );
  });
});
