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
  return (
    <div className="scanner-overlay" role="dialog" aria-label="Review photo before sending">
      <div className="ai-confirm">
        <img src={image} alt="Captured food" className="ai-photo" />
        <label htmlFor="ai-note" className="ai-refine-label">
          Add context for the AI (optional), e.g. “I didn’t eat the ranch”
        </label>
        <textarea
          id="ai-note"
          className="ai-note-input"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Anything the photo doesn't show?"
          rows={2}
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
