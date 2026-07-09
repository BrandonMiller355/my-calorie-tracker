import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PhotoCapture } from './PhotoCapture';

// jsdom has no camera, no real image decoder, and no canvas 2d context, so
// the file-picker path (URL.createObjectURL -> Image -> canvas) is stubbed
// out here the same way the camera itself is untestable in this environment.
let nextImageShouldFail = false;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_value: string) {
    queueMicrotask(() => {
      if (nextImageShouldFail) this.onerror?.();
      else this.onload?.();
    });
  }
}

function chooseFile(file: File) {
  const input = screen.getByLabelText('Choose a photo from your device') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('PhotoCapture', () => {
  beforeEach(() => {
    nextImageShouldFail = false;
    vi.stubGlobal('Image', FakeImage);
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,mock',
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  it('offers the library picker as the primary action when no camera is available', () => {
    render(<PhotoCapture onCapture={() => {}} onCancel={() => {}} />);

    expect(
      screen.getByRole('button', { name: /Choose a photo from your device/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
  });

  it('downscales a chosen image file and hands the result to onCapture', async () => {
    const onCapture = vi.fn();
    render(<PhotoCapture onCapture={onCapture} onCancel={() => {}} />);

    chooseFile(new File(['fake'], 'lunch.jpg', { type: 'image/jpeg' }));

    await waitFor(() =>
      expect(onCapture).toHaveBeenCalledWith('data:image/jpeg;base64,mock'),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('shows an error and does not call onCapture for an undecodable file', async () => {
    nextImageShouldFail = true;
    const onCapture = vi.fn();
    render(<PhotoCapture onCapture={onCapture} onCancel={() => {}} />);

    chooseFile(new File(['not an image'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "couldn't be used as a photo",
    );
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('does nothing when the file picker is dismissed without a selection', () => {
    const onCapture = vi.fn();
    render(<PhotoCapture onCapture={onCapture} onCancel={() => {}} />);

    const input = screen.getByLabelText('Choose a photo from your device') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(onCapture).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancelling returns control via onCancel', () => {
    const onCancel = vi.fn();
    render(<PhotoCapture onCapture={() => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
