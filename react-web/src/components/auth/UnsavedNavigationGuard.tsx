"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/auth/ConfirmDialog";

export function UnsavedNavigationGuard({
  active,
  title,
  body,
  cancelLabel,
  confirmLabel,
}: {
  active: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
}) {
  const router = useRouter();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmAnchorNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;
      const anchor = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
      if (
        !anchor
        || anchor.target === "_blank"
        || anchor.hasAttribute("download")
        || anchor.origin !== window.location.origin
      ) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const destination = new URL(anchor.href);
      setLeaveTo(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", confirmAnchorNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", confirmAnchorNavigation, true);
    };
  }, [active]);

  if (!leaveTo) return null;

  return (
    <ConfirmDialog
      id="unsaved-navigation"
      title={title}
      body={body}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      onCancel={() => setLeaveTo(null)}
      onConfirm={() => {
        const destination = leaveTo;
        setLeaveTo(null);
        router.push(destination);
      }}
    />
  );
}
