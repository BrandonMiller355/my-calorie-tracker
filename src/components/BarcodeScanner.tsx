import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Retail product formats the detector must support for scanning to be offered. */
const RETAIL_BARCODE_FORMATS = ['ean_13', 'upc_a', 'upc_e', 'ean_8'];

const DETECT_INTERVAL_MS = 200;

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

// BarcodeDetector (Android/Chrome) isn't in TypeScript's DOM lib yet.
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

/**
 * True when the browser can natively detect at least one retail (1D) barcode
 * format. The API existing doesn't guarantee 1D support, so the formats list
 * is checked too.
 */
export async function isBarcodeScanningSupported(): Promise<boolean> {
  const Detector = window.BarcodeDetector;
  if (!Detector) return false;
  try {
    const formats = await Detector.getSupportedFormats();
    return RETAIL_BARCODE_FORMATS.some((f) => formats.includes(f));
  } catch {
    return false;
  }
}

function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return 'Camera access was denied. Allow camera access in your browser settings to scan barcodes.';
  }
  if (err instanceof DOMException && err.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }
  return 'The camera could not be started.';
}

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onCancel: () => void;
  /** Rendered under the error message when the camera can't start (e.g. a manual-entry link). */
  fallback?: ReactNode;
}

/**
 * Full-screen camera view that reports the first retail barcode it sees.
 * Assumes support was already confirmed via isBarcodeScanningSupported().
 * The camera stream is stopped on detection, cancel, and unmount.
 */
export function BarcodeScanner({ onDetected, onCancel, fallback }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Kept in a ref so a parent re-render doesn't restart the camera effect.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    const videoEl = videoRef.current;
    const Detector = window.BarcodeDetector;
    if (!videoEl || !Detector) return;
    // Narrowed copy: TS doesn't carry the null check into the closures below.
    const video: HTMLVideoElement = videoEl;
    const detector = new Detector({ formats: RETAIL_BARCODE_FORMATS });

    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    let detecting = false;

    function stop() {
      window.clearInterval(timer);
      // Leaked tracks keep the phone's camera indicator on
      stream?.getTracks().forEach((t) => t.stop());
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch (err) {
        if (!stopped) setCameraError(cameraErrorMessage(err));
        return;
      }
      if (stopped) {
        stop();
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // play() rejects if we unmounted mid-flight; cleanup handles the stream
      }
      if (stopped) return;

      timer = window.setInterval(async () => {
        if (detecting || stopped || video.readyState < 2) return;
        detecting = true;
        try {
          const barcodes = await detector.detect(video);
          const hit = barcodes.find((b) => b.rawValue);
          if (hit && !stopped) {
            stopped = true;
            stop(); // release the camera before the lookup starts
            onDetectedRef.current(hit.rawValue);
          }
        } catch {
          // detect() can throw while frames aren't ready; try the next tick
        }
        detecting = false;
      }, DETECT_INTERVAL_MS);
    }

    void start();

    return () => {
      stopped = true;
      stop();
    };
  }, []);

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Barcode scanner">
      {cameraError ? (
        <div className="scanner-error" role="alert">
          <p>{cameraError}</p>
          {fallback}
        </div>
      ) : (
        <>
          <video ref={videoRef} className="scanner-video" playsInline muted />
          <p className="scanner-hint">Point the camera at a barcode</p>
        </>
      )}
      <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
