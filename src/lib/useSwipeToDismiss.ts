import { useRef, useState, type CSSProperties, type TouchEvent } from 'react';

/** How far the handle must be dragged down before release dismisses the sheet. */
const DISMISS_THRESHOLD_PX = 80;

/**
 * Drags-to-dismiss for a bottom sheet's handle bar. The handle already reads
 * as a "swipe down to close" affordance; this makes that gesture real. Only
 * tracks touches that start on the handle itself, so it never fights with
 * scrolling the sheet's content.
 */
export function useSwipeToDismiss(onDismiss: () => void) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  function onTouchStart(e: TouchEvent) {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  }

  function onTouchMove(e: TouchEvent) {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  }

  function onTouchEnd() {
    if (dragY > DISMISS_THRESHOLD_PX) {
      onDismiss();
    } else {
      setDragY(0);
    }
    setDragging(false);
    startY.current = null;
  }

  const sheetStyle: CSSProperties = {
    transform: dragY ? `translateY(${dragY}px)` : undefined,
    transition: dragging ? 'none' : undefined,
  };

  return { sheetStyle, handleProps: { onTouchStart, onTouchMove, onTouchEnd } };
}
