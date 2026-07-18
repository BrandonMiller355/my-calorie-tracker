import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { captureFrame, loadImageFile } from '../lib/photo';

function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return 'Camera access was denied. Allow camera access in your browser settings to photograph food.';
  }
  if (err instanceof DOMException && err.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }
  return 'The camera could not be started.';
}

interface PhotoCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
  /** Rendered under the error message when the camera can't start (e.g. a manual-entry link). */
  fallback?: ReactNode;
}

/**
 * Rear-camera view with a shutter button that captures a single downscaled
 * JPEG frame, plus a "choose from library" action that downscales an
 * existing image file the same way. Whichever source is unavailable (no
 * camera, or the user hasn't picked a file) simply isn't shown; when the
 * camera can't be used at all, the file picker becomes the only action. The
 * camera stream is stopped on capture, file selection, cancel, and unmount
 * (same lifecycle rules as BarcodeScanner).
 */
export function PhotoCapture({ onCapture, onCancel, fallback }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Kept in a ref so a parent re-render doesn't restart the camera effect.
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  // Checked once at mount; this browser capability doesn't change mid-session.
  const cameraSupported = typeof navigator.mediaDevices?.getUserMedia === 'function';

  useEffect(() => {
    if (!cameraSupported) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const video: HTMLVideoElement = videoEl;

    let stopped = false;
    let restartTimer: number | undefined;

    function stop() {
      // Leaked tracks keep the phone's camera indicator on
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    async function start() {
      stop();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            // Defaults can be 640x480; ask for a sharper frame for the photo
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (err) {
        if (!stopped) setCameraError(cameraErrorMessage(err));
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // play() rejects if we unmounted mid-flight; cleanup handles the stream
      }
      if (!stopped) setReady(true);
    }

    // The stream keeps the orientation it was opened in (Android), so a
    // rotated phone would preview — and capture — sideways frames. Reopen the
    // camera when the device rotates; debounced because rotation fires a burst
    // of resize events.
    function handleOrientationChange() {
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        if (!stopped) {
          setReady(false);
          void start();
        }
      }, 250);
    }

    void start();
    screen.orientation?.addEventListener('change', handleOrientationChange);

    return () => {
      stopped = true;
      window.clearTimeout(restartTimer);
      screen.orientation?.removeEventListener('change', handleOrientationChange);
      stop();
    };
  }, []);

  function shutter() {
    const video = videoRef.current;
    if (!video) return;
    const image = captureFrame(video);
    if (!image) return; // frame not ready yet; the button stays live
    // Release the camera before analysis starts
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onCaptureRef.current(image);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after an error or a retake
    if (!file) return; // user dismissed the picker without choosing anything
    setFileError(null);
    try {
      const image = await loadImageFile(file);
      if (!image) {
        setFileError("That file couldn't be used as a photo.");
        return;
      }
      // Release the camera (if it was running) before analysis starts
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      onCaptureRef.current(image);
    } catch {
      setFileError("That file couldn't be used as a photo.");
    }
  }

  const cameraUsable = cameraSupported && !cameraError;

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Photograph food">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden-file-input"
        aria-label="Choose a photo from your device"
        onChange={(e) => void handleFileChange(e)}
      />
      {cameraUsable ? (
        <>
          <video ref={videoRef} className="scanner-video" playsInline muted />
          <p className="scanner-hint">Frame the food, then take the photo</p>
          {fileError && (
            <div className="scanner-error" role="alert">
              <p>{fileError}</p>
            </div>
          )}
          <button
            type="button"
            className="shutter-button"
            onClick={shutter}
            disabled={!ready}
            aria-label="Take photo"
          >
            📷 Take photo
          </button>
          <button type="button" className="library-button secondary" onClick={openFilePicker}>
            🖼️ Choose from library
          </button>
        </>
      ) : (
        <div className="photo-picker-panel">
          {cameraError && (
            <div className="scanner-error" role="alert">
              <p>{cameraError}</p>
            </div>
          )}
          {fileError && (
            <div className="scanner-error" role="alert">
              <p>{fileError}</p>
            </div>
          )}
          <button type="button" className="library-button" onClick={openFilePicker}>
            🖼️ Choose a photo from your device
          </button>
          {fallback}
        </div>
      )}
      <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
