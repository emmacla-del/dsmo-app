"use client";

import { useEffect, useRef } from "react";

/**
 * A yes/no confirmation on the native dialog element, the same contract as
 * the registration wizard's ConfirmDialog. showModal() supplies the focus
 * trap, Escape, the inert background and focus return. Mounted only while
 * it is asked: opening is the mount, and every close ends in onCancel
 * unless the confirm button set the flag first.
 */
export function ScopeConfirmDialog({
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
  const confirmedRef = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // The safe answer takes focus: Enter on an unread dialog must not erase
    // an answer or open the tables.
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className="cam-confirm-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onClose={() => {
        if (!confirmedRef.current) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="cam-confirm-dialog-inner">
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-body`}>{body}</p>
        <div className="cam-confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="cam-button cam-button-secondary"
            onClick={() => ref.current?.close()}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="cam-button cam-button-primary"
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
