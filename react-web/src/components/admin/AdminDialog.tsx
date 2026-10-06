"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface AdminDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

/**
 * Console dialog on the native <dialog> element: showModal() gives focus
 * trapping, Escape-to-close, an inert background and focus return for free,
 * which the previous hand-rolled fixed-position overlays lacked.
 */
export function AdminDialog({ open, onClose, title, eyebrow, footer, wide, children }: AdminDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("adminDialog");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`cam-admin-dialog${wide ? " is-wide" : ""}`}
      aria-labelledby="cam-admin-dialog-title"
      onClose={onClose}
    >
      {open && (
        <>
          <div className="cam-admin-dialog-head">
            <div>
              {eyebrow && <div className="cam-admin-dialog-eyebrow">{eyebrow}</div>}
              <h2 className="cam-admin-dialog-title" id="cam-admin-dialog-title">
                {title}
              </h2>
            </div>
            <button type="button" className="cam-admin-dialog-close" aria-label={t("closeAriaLabel")} onClick={onClose}>
              ×
            </button>
          </div>
          <div className="cam-admin-dialog-body">{children}</div>
          {footer && <div className="cam-admin-dialog-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
