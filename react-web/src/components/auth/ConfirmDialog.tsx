"use client";

import { useEffect, useRef } from "react";

// A yes/no confirmation for the registration wizard (leave, change the
// organisation type), on the native <dialog> element as AdminDialog is:
// showModal() gives the focus trap, Escape, the inert background and focus
// return. The hand-rolled overlay it replaces left focus on <body>, ignored
// Escape and let Tab walk the form underneath.
//
// Mounted only while it is asked: the caller renders it conditionally, so
// opening is the mount and every way of closing (Escape, the cancel button,
// a click on the backdrop) ends in onCancel.
export function ConfirmDialog({
  id,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  id: string;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Set by the confirm button so the close event that follows it is not
  // also reported as a cancel.
  const confirmedRef = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // The safe answer takes focus: Enter on an unread dialog must not leave
    // the form or erase an answer.
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className="leave-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onClose={() => {
        if (!confirmedRef.current) onCancel();
      }}
      onClick={(e) => {
        // A click on the ::backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      {/* The padding lives on this inner block, so a click anywhere on the
          dialog's own element is a click on the backdrop. */}
      <div className="leave-dialog-inner">
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-body`}>{body}</p>
        <div className="leave-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn-secondary"
            onClick={() => ref.current?.close()}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-primary btn-primary--inline"
            onClick={() => {
              confirmedRef.current = true;
              ref.current?.close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
