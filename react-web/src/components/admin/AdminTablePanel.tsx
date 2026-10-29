import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export interface AdminTablePanelProps {
  title?: ReactNode;
  id?: string;
  /** Assign an id when the panel heading is referenced by aria-labelledby. */
  headingId?: string;
  description?: ReactNode;
  /** Result totals or context, aligned with the heading. */
  meta?: ReactNode;
  /** Page-specific actions such as export or create. */
  actions?: ReactNode;
  /** Filters and search controls. */
  toolbar?: ReactNode;
  /** Table markup; use the shared shadcn Table primitives where applicable. */
  children: ReactNode;
  /** Pagination, notes, or other table footer content. */
  footer?: ReactNode;
  className?: string;
  /** Additional style class for a layout variant, such as a workflow queue. */
  cardClassName?: string;
  /** Keeps the shared card, table, and responsive frame when a page provides its own heading. */
  showHeader?: boolean;
  busy?: boolean;
  /** Localized, polite feedback shown while retained results are refreshing. */
  busyLabel?: ReactNode;
}

/**
 * Shared frame for administrative data views. It standardizes the panel,
 * heading, filter area, scrollable table region, and footer while leaving the
 * page in charge of columns, data requests, filters, permissions, and actions.
 */
export function AdminTablePanel({
  title,
  id,
  headingId,
  description,
  meta,
  actions,
  toolbar,
  children,
  footer,
  className = "",
  cardClassName = "",
  showHeader = true,
  busy,
  busyLabel,
}: AdminTablePanelProps) {
  return (
    <section id={id} className={`cam-admin-table-panel ${className}`.trim()} aria-labelledby={headingId} aria-busy={busy || undefined}>
      <Card className={`cam-admin-panel-surface cam-admin-table-panel-card ${cardClassName}`.trim()}>
        {busy && busyLabel && <p className="px-4 pt-3 text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">{busyLabel}</p>}
        {showHeader && (
          <div className="cam-admin-table-panel-head">
            <div className="cam-admin-table-panel-heading">
              {title && <h2 id={headingId} className="cam-admin-table-panel-title">{title}</h2>}
              {description && <p className="cam-admin-table-panel-description">{description}</p>}
              {meta && <div className="cam-admin-table-panel-meta">{meta}</div>}
            </div>
            {actions && <div className="cam-admin-table-panel-actions">{actions}</div>}
          </div>
        )}
        {toolbar && <div className="cam-admin-table-panel-toolbar">{toolbar}</div>}
        <div className="cam-admin-table-panel-content">{children}</div>
        {footer && <div className="cam-admin-table-panel-footer">{footer}</div>}
      </Card>
    </section>
  );
}
