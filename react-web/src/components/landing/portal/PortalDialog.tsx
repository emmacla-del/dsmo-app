import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import styles from "../portal.module.css";

// A native <dialog>, for the same reason AdminDialog is one (rule G7 of
// docs/standards/ui-grammar.md): the focus trap, Escape, the inert background
// and returning focus to whatever opened it all come from the platform. A
// hand-rolled overlay re-implements four accessibility behaviours and gets at
// least one of them wrong.
//
// This is a sibling of AdminDialog rather than a shared component lifted out
// of it. Lifting would mean touching the staff console, which the landing work
// deliberately does not — see docs/plans/landing-portal.md. The duplication is
// about thirty lines, and it is a decision, not an oversight.
//
// `open` is driven by the caller's state, and `onClose` is wired to the
// dialog's own close event, so Escape and a backdrop click travel back to the
// caller instead of leaving React's state disagreeing with the DOM.

export function PortalDialog({
  open,
  onClose,
  titleId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // The backdrop is part of the <dialog> element itself, so a click that
      // lands on the element rather than on its contents is a click outside.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles.dialogBody}>
        <div className={styles.dialogHead}>
          <p className={styles.eyebrow}>{t("portalPage.dialogEyebrow")}</p>
          {/* Styled here rather than with .cam-button-sm: that modifier lives
              in admin-console.css, which this page never loads. */}
          <button type="button" className={styles.dialogClose} onClick={onClose}>
            {t("portalPage.dialogClose")}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
