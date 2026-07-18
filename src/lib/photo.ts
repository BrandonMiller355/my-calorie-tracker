/** Long-edge cap for the exported JPEG; food recognition needs no more. */
const MAX_EDGE_PX = 1024;
const JPEG_QUALITY = 0.8;

/** Downscales any drawable source to a JPEG data URL whose long edge is capped at MAX_EDGE_PX. */
function downscaleToJpeg(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
): string | null {
  if (!naturalWidth || !naturalHeight) return null;
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(naturalWidth, naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(naturalWidth * scale);
  canvas.height = Math.round(naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** The current video frame as a JPEG data URL, downscaled to MAX_EDGE_PX. */
export function captureFrame(video: HTMLVideoElement): string | null {
  return downscaleToJpeg(video, video.videoWidth, video.videoHeight);
}

/**
 * Loads an image file and downscales it the same way a camera frame is.
 * Resolves to null (not rejects) if the source has no readable dimensions;
 * rejects only if the file can't be decoded as an image at all.
 */
export function loadImageFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(downscaleToJpeg(img, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not a decodable image'));
    };
    img.src = url;
  });
}
