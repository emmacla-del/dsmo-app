"use client";

import { useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ArchiveActionsProps {
  archived: boolean;
  canManage: boolean;
  resourceName: string;
  archiveLabel: string;
  restoreLabel: string;
  confirmTitle: string;
  reasonLabel: string;
  cancelLabel: string;
  onArchive: (reason: string) => void;
  onRestore: () => void;
}

/** Shared archive/restore row control used by both admin modules. */
export function ArchiveActions({
  archived, canManage, resourceName, archiveLabel, restoreLabel,
  confirmTitle, reasonLabel, cancelLabel, onArchive, onRestore,
}: ArchiveActionsProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!canManage) return null;

  return (
    <>
      {archived ? (
        <Button type="button" variant="link" size="sm" className="h-auto px-0 underline" onClick={onRestore}>{restoreLabel}</Button>
      ) : (
        <Button type="button" variant="link" size="sm" className="h-auto px-0 underline" onClick={() => { setReason(""); setOpen(true); }}>{archiveLabel}</Button>
      )}
      <AdminDialog
        open={open}
        onClose={() => setOpen(false)}
        title={confirmTitle}
        eyebrow={resourceName}
        footer={
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>{cancelLabel}</Button>
            <Button type="button" size="sm" variant="destructive" disabled={!reason.trim()} onClick={() => { onArchive(reason.trim()); setOpen(false); }}>{archiveLabel}</Button>
          </>
        }
      >
        <div className="grid gap-2">
          <Label htmlFor="archive-action-reason">{reasonLabel} <span aria-hidden="true">*</span></Label>
          <Textarea id="archive-action-reason" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
      </AdminDialog>
    </>
  );
}
