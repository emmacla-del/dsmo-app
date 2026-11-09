"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { LanguageLink } from "@/components/LanguageLink";

export interface AdminAccountMenuProps {
  name: string;
  role: string;
  /** « National », « Centre »… already worded; shown in the menu. */
  scope?: string;
  canOpenSettings: boolean;
  onLogout: () => void;
}

/**
 * The signed-in officer in the masthead bar (canvas board « Examen des
 * inscriptions », 2026-11-08): initials, name and role, opening a menu with
 * settings, territory, language and sign-out. It moved here from the foot
 * of the rail, so the rail holds navigation only.
 */
export function AdminAccountMenu({ name, role, scope, canOpenSettings, onLogout }: AdminAccountMenuProps) {
  const t = useTranslations("adminSidebar");
  const tHeader = useTranslations("adminHeaderActions");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Closes on navigation, caught while rendering rather than in an effect.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  const initials = name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="cam-admin-account" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="cam-admin-account-trigger"
        aria-expanded={open}
        aria-controls="cam-admin-account-menu"
        aria-label={t("accountMenuAriaLabel")}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="cam-admin-rail-avatar" aria-hidden="true">{initials}</span>
        <span className="cam-admin-account-trigger-copy">
          <span className="cam-admin-rail-user-name">{name}</span>
          <span className="cam-admin-rail-user-role">{role}</span>
        </span>
        <ChevronDown className={`cam-admin-account-trigger-chevron${open ? " is-open" : ""}`} size={16} aria-hidden="true" />
      </button>

      {open && (
        <div id="cam-admin-account-menu" className="cam-admin-account-menu" aria-label={t("accountMenuAriaLabel")}>
          {canOpenSettings && (
            <Link href="/admin/parametres" className="cam-admin-account-menu-link" onClick={() => setOpen(false)}>
              <Settings size={15} aria-hidden="true" />
              <span>{t("accountSettingsButton")}</span>
            </Link>
          )}
          {scope && (
            <div className="cam-admin-account-menu-territory">
              <span>{tHeader("scopeTitle")}</span>
              <span className="cam-admin-scope" title={tHeader("scopeTitle")}>{tHeader("scopeChip", { scope })}</span>
            </div>
          )}
          <div className="cam-admin-account-menu-language">
            <span>{t("languageLabel")}</span>
            <LanguageLink compact />
          </div>
          <button type="button" onClick={() => { setOpen(false); onLogout(); }} className="cam-admin-rail-logout">
            <LogOut size={14} aria-hidden="true" />
            <span>{t("logoutButton")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
