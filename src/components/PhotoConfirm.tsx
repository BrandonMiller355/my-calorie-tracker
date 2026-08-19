import { useBackHandler } from '../state/BackNavigation';
import { ClearableTextarea } from './ClearableInput';

/**
 * Pre-send photo review, shared by the AI analyze and identify flows: the
 * frozen captured frame, an optional context note for the model, and
 * retake/send/cancel actions. Nothing is sent until `onSend`.
 */
interface PhotoConfirmProps {
  image: string;
  note: string;
  onNoteChange: (note: string) => void;
  onRetake: () => void;
  onSend: () => void;
  onCancel: () => void;
  /** Send button text, e.g. "Analyze" or "Identify" */
  sendLabel: string;
}

export function PhotoConfirm({
  image,
  note,
  onNoteChange,
  onRetake,
  onSend,
  onCancel,
  sendLabel,
}: PhotoConfirmProps) {
  // Back steps this phase back to the camera rather than abandoning the flow —
  // the review step's own "Retake" is what it means to go back from here.
  useBackHandler(true, onRetake);

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Review photo before sending">
      <div className="ai-confirm">
        <img src={image} alt="Captured food" className="ai-photo" />
        <label htmlFor="ai-note" className="ai-refine-label">
          Add context for the AI (optional), e.g. “I didn’t eat the ranch”
        </label>
        <ClearableTextarea
          id="ai-note"
          className="ai-note-input"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Anything the photo doesn't show?"
          rows={2}
          clearLabel="Clear note"
        />
        <div className="ai-confirm-actions">
          <button type="button" className="secondary" onClick={onRetake}>
            Retake
          </button>
          <button type="button" className="ai-accept" onClick={onSend}>
            {sendLabel}
          </button>
        </div>
      </div>
      <button type="button" className="scanner-cancel secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
