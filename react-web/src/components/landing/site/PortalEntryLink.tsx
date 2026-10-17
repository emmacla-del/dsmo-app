"use client";

import Link from "next/link";
import { usePortalEntry } from "./use-portal-entry";

/** A registration button that, once the visitor is signed in, takes them
    back to their survey or the console instead. */
export function PortalEntryLink({ className, guestLabel }: { className?: string; guestLabel: string }) {
  const entry = usePortalEntry();
  return (
    <Link href={entry.actionHref} className={className}>
      {entry.actionLabel(guestLabel)}
    </Link>
  );
}
