"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface AdminSavedView {
  name: string;
  /** The list's query string, without the leading « ? ». */
  query: string;
}

/** URL keys that describe where the reader is, not what the list shows. */
const TRANSIENT_KEYS = ["page", "preview", "decisionNotice", "endOfQueue", "reviewMove"];

/** The list's own state, as saved in a view. */
export function savedViewQuery(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of TRANSIENT_KEYS) params.delete(key);
  for (const key of [...params.keys()]) if (key.endsWith("Page")) params.delete(key);
  return params.toString();
}

const listeners = new Set<() => void>();
const EMPTY: AdminSavedView[] = [];
const cache = new Map<string, { raw: string | null; views: AdminSavedView[] }>();

function readViews(storageKey: string): AdminSavedView[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return EMPTY;
  }
  const cached = cache.get(storageKey);
  if (cached && cached.raw === raw) return cached.views;
  let views: AdminSavedView[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      views = parsed.filter((item): item is AdminSavedView =>
        Boolean(item) && typeof item.name === "string" && typeof item.query === "string");
    }
  } catch {
    views = EMPTY;
  }
  cache.set(storageKey, { raw, views });
  return views;
}

function writeViews(storageKey: string, views: AdminSavedView[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(views));
  } catch {
    // Storage refused (private window, quota): the views stay as they were.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Saved views of an admin list: a name for the current filters, kept for this
 * officer on this device (browser storage, keyed by user). Applying a view
 * replaces the list's URL state; nothing is sent to the server.
 */
export function AdminSavedViews({ storageKey, currentQuery, onApply }: {
  /** Per list and per officer, e.g. « camleap.savedViews.dossiers.<userId> ». */
  storageKey: string;
  /** savedViewQuery() of the list's current URL. */
  currentQuery: string;
  onApply: (query: string) => void;
}) {
  const t = useTranslations("adminSavedViews");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const views = useSyncExternalStore(subscribe, () => readViews(storageKey), () => EMPTY);
  const filterCount = (query: string) =>
    [...new URLSearchParams(query).keys()].filter((key) => key !== "vue" && key !== "queueView").length;
  const canSave = name.trim().length > 0 && filterCount(currentQuery) > 0;

  const save = () => {
    if (!canSave) return;
    const trimmed = name.trim();
    writeViews(storageKey, [...views.filter((view) => view.name !== trimmed), { name: trimmed, query: currentQuery }]);
    setName("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cam-filter-pill cam-saved-views-trigger" aria-haspopup="dialog">
          <Bookmark aria-hidden="true" className="size-4" />
          {t("menuLabel")}
          {views.length > 0 && <span className="cam-dossier-filter-count">{views.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="cam-saved-views-popover">
        {views.length === 0 ? (
          <p className="cam-admin-meta cam-saved-views-empty">{t("empty")}</p>
        ) : (
          <ul className="cam-saved-views-list">
            {views.map((view) => (
              <li key={view.name}>
                <button
                  type="button"
                  className="cam-saved-views-apply"
                  aria-current={view.query === currentQuery ? "true" : undefined}
                  onClick={() => { onApply(view.query); setOpen(false); }}
                >
                  <strong>{view.name}</strong>
                  <span className="cam-admin-meta">{t("filterCount", { count: filterCount(view.query) })}</span>
                </button>
                <button
                  type="button"
                  className="cam-saved-views-remove"
                  aria-label={t("remove", { name: view.name })}
                  onClick={() => writeViews(storageKey, views.filter((item) => item.name !== view.name))}
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="cam-saved-views-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <label className="cam-admin-label" htmlFor="cam-saved-view-name">{t("saveLabel")}</label>
          <div className="cam-saved-views-row">
            <input
              id="cam-saved-view-name"
              className="cam-input"
              value={name}
              placeholder={t("namePlaceholder")}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className="cam-button cam-button-primary cam-button-sm" disabled={!canSave}>{t("save")}</button>
          </div>
          <p className="cam-admin-meta">{filterCount(currentQuery) > 0 ? t("hint") : t("nothingToSave")}</p>
        </form>
      </PopoverContent>
    </Popover>
  );
}
