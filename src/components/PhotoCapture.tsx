import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Long-edge cap for the exported JPEG; food recognition needs no more. */
const MAX_EDGE_PX = 1024;
const JPEG_QUALITY = 0.8;

function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return 'Camera access was denied. Allow camera access in your browser settings to photograph food.';
  }
  if (err instanceof DOMException && err.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }
  return 'The camera could not be started.';
}

/** The current video frame as a JPEG data URL, downscaled to MAX_EDGE_PX. */
function captureFrame(video: HTMLVideoElement): string | null {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(videoWidth, videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(videoWidth * scale);
  canvas.height = Math.round(videoHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

interface PhotoCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
  /** Rendered under the error message when the camera can't start (e.g. a manual-entry link). */
  fallback?: ReactNode;
}

/**
 * Rear-camera view with a shutter button that captures a single downscaled
 * JPEG frame. The camera stream is stopped on capture, cancel, and unmount
 * (same lifecycle rules as BarcodeScanner).
 */
export function PhotoCapture({ onCapture, onCancel, fallback }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Kept in a ref so a parent re-render doesn't restart the camera effect.
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  useEffect(() => {
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

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Photograph food">
      {cameraError ? (
        <div className="scanner-error" role="alert">
          <p>{cameraError}</p>
          {fallback}
        </div>
      ) : (
        <>
          <video ref={videoRef} className="scanner-video" playsInline muted />
          <p className="scanner-hint">Frame the food, then take the photo</p>
          <button
            type="button"
            className="shutter-button"
            onClick={shutter}
            disabled={!ready}
            aria-label="Take photo"
          >
            📷 Take photo
          </button>
        </>
      )}
      <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
