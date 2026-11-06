"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface AccountActionConfirmProps {
  /** Names the record and the consequence. */
  message: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  /** When set, the action stays disabled until exactly this text is typed. */
  typedConfirmation?: { value: string; label: string };
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Second step of an account action, shown under its row. Inline because these
 * actions already sit in a dialog, and a dialog does not open on a dialog.
 * Focus moves in on open and returns to the opening button on cancel.
 */
export function AccountActionConfirm({
  message,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  destructive = false,
  typedConfirmation,
  pending,
  error,
  onCancel,
  onConfirm,
}: AccountActionConfirmProps) {
  const [typed, setTyped] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const matches = !typedConfirmation || typed.trim() === typedConfirmation.value;

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    boxRef.current?.focus();
  }, []);

  const cancel = () => {
    onCancel();
    openerRef.current?.focus();
  };

  return (
    <div ref={boxRef} tabIndex={-1} role="group" aria-label={confirmLabel} className="mt-3 flex flex-col gap-3 outline-none">
      <p className="text-sm">{message}</p>
      {typedConfirmation && (
        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="account-action-typed">{typedConfirmation.label}</label>
          <input
            id="account-action-typed"
            type="text"
            className="cam-input"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={cancel}>{cancelLabel}</Button>
        <Button
          type="button"
          size="sm"
          variant={destructive ? "destructive" : "default"}
          disabled={!matches || pending}
          onClick={onConfirm}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
