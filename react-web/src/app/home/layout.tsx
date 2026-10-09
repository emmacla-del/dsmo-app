"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ApiError, clearToken, getCachedUser, getMyAttestation } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useRequireAuth } from "@/lib/use-require-auth";
import { navItemsForRole, resolveEffectiveRole, roleLabelKey } from "@/lib/role-navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";
import { activeQuarterQueryOptions, meQueryOptions } from "@/lib/shared-queries";

/**
 * Phase 3 home shell — role-aware navigation ported from home_screen.dart's
 * _buildTabs/_buildDrawer (see role-navigation.ts for the exact mapping).
 * Deliberately real Next.js routes per destination (/home/<slug>) rather
 * than Flutter's in-memory tab-index switching: bookmarkable URLs and
 * working browser back/forward are a "materially better browser-native web
 * experience" (the plan's own Phase 5 acceptance criterion, applied here to
 * navigation too), not a mechanical port of Flutter's own mechanism.
 *
 * Only one destination is real today (the ONEFOP declaration entry point,
 * /onefop/preview, built earlier this migration) — every other item links
 * to an honest "not yet migrated" placeholder rather than a fabricated
 * screen, per the plan's Phase 6 per-module retirement model.
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const authState = useRequireAuth();
  const authUser = useAuthStore((s) => s.user);
  const meQuery = useQuery({
    ...meQueryOptions,
    enabled: authState === "authed",
    initialData: authUser ?? getCachedUser() ?? undefined,
  });
  const user = meQuery.data ?? authUser ?? getCachedUser();
  const awaitingApproval =
    user?.role === "COMPANY" &&
    (user.status === "PENDING_APPROVAL" || user.status === "COMPLEMENTS_REQUESTED");
  // The active-quarter route is guarded, and a company still under review is
  // denied it. Left enabled, every mount fires a request that comes back 403
  // and sends the browser to the status page this layout is already
  // redirecting to — a loop. Disabled rather than exempted server-side: a
  // company that cannot declare yet has no active quarter to speak of.
  const quarterQuery = useQuery({
    ...activeQuarterQueryOptions,
    enabled: authState === "authed" && !awaitingApproval,
  });
  const [isNewDeclarationOpen, setIsNewDeclarationOpen] = useState(false);
  const [attestationLoading, setAttestationLoading] = useState(false);
  const [attestationError, setAttestationError] = useState<string | null>(null);
  // Mirrors home_screen.dart's "Mon attestation d'inscription" menu entry.
  // The backend guards the route with ActiveCompanyGuard, so the button is
  // only offered to an active company.
  const canDownloadAttestation = user?.role === "COMPANY" && user.status === "ACTIVE";

  async function openAttestation() {
    setAttestationError(null);
    setAttestationLoading(true);
    // Opened before the request, inside the click, so the browser treats it
    // as user-initiated: a window.open() after an await is popup-blocked.
    const tab = window.open("", "_blank");
    try {
      const { url } = await getMyAttestation();
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (e) {
      tab?.close();
      // 400 is the backend's "no attestation stored for this account" --
      // a pending approval, or a PDF that failed to generate.
      setAttestationError(
        e instanceof ApiError && e.status === 400
          ? t("homeLayout.attestationUnavailable")
          : t("homeLayout.attestationOpenError"),
      );
    } finally {
      setAttestationLoading(false);
    }
  }
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // A company whose registration is still under review holds a valid
  // session but has no operational screens yet, so it belongs on its status
  // page. This runs in an effect rather than in render: router.replace() in
  // a render body is a side effect in render and re-fires under StrictMode.
  useEffect(() => {
    if (!mounted || authState !== "authed") return;
    if (awaitingApproval && pathname !== "/home/inscription-en-attente") {
      router.replace("/home/inscription-en-attente");
    }
  }, [mounted, authState, awaitingApproval, pathname, router]);

  if (!mounted || authState !== "authed") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cam-bg)", color: "var(--cam-text-muted)" }}>
        {t("common.loading")}
      </div>
    );
  }

  const effectiveRole = user ? resolveEffectiveRole(user) : null;
  const navItems = (effectiveRole ? navItemsForRole(effectiveRole) : []).filter(
    (item) => !item.rawRoles || (!!user && item.rawRoles.includes(user.role)),
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--cam-bg)", color: "var(--cam-text)", fontFamily: "var(--cam-font-sans)" }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "var(--cam-border-width) solid var(--cam-border)",
          background: "var(--cam-surface)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--cam-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--cam-green)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 11 }}>
              R.C.
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--cam-text)" }}>CAM-LEAP · MINEFOP</div>
              <div style={{ fontSize: "11px", color: "var(--cam-text-muted)" }}>
                {quarterQuery.data?.label ?? quarterQuery.data?.code ?? t("homeLayout.currentCampaign")}
              </div>
              {/* A closed period must not read as the live campaign. The
                  badge otherwise shows the round's label either way, which
                  is the one always-visible place a respondent would still
                  infer the campaign is collecting. */}
              {quarterQuery.data?.isOpen === false && (
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--cam-warning)", marginTop: 1 }}>
                  {t("homeLayout.periodClosed")}
                </div>
              )}
            </div>
          </div>
          {user && (
            <div style={{ marginTop: 12, padding: "8px 10px", background: "var(--cam-bg)", borderRadius: 6, border: "1px solid var(--cam-border)" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--cam-text)", overflowWrap: "break-word" }}>
                {user.email}
              </div>
              <div style={{ fontSize: "10.5px", color: "var(--cam-green)", fontWeight: 700, marginTop: 2 }}>
                {roleLabelKey(effectiveRole!) ? t(roleLabelKey(effectiveRole!)!) : effectiveRole}
              </div>
            </div>
          )}
        </div>

        {/* Global New Declaration CTA button: EXCLUSIVELY for COMPANY roles */}
        {user?.role === "COMPANY" && (
          <div style={{ padding: "12px 16px 4px" }}>
            <button
              type="button"
              onClick={() => setIsNewDeclarationOpen(true)}
              className="cam-button cam-button-primary cam-button-block"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 12.5,
                padding: "8px 12px",
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>＋</span>
              {t("homeLayout.newDeclarationButton")}
            </button>
          </div>
        )}

        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item) => {
            const href = item.route ?? `/home/${item.slug}`;
            const active = item.route ? pathname === item.route : pathname === `/home/${item.slug}`;
            return (
              <Link
                key={item.slug}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 20px",
                  fontSize: "12.5px",
                  color: active ? "var(--cam-green)" : "var(--cam-text)",
                  background: active ? "rgba(0, 122, 94, 0.08)" : "transparent",
                  borderLeft: active ? "3px solid var(--cam-green)" : "3px solid transparent",
                  textDecoration: "none",
                  fontWeight: active ? 700 : 500,
                  transition: "all 0.15s ease",
                }}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "var(--cam-space-4)", borderTop: "var(--cam-border-width) solid var(--cam-border)" }}>
          {/* Interface language, as on the admin rail: the respondent area had
              no switcher outside the ONEFOP wizard header. */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--cam-space-3)" }}>
            <LocaleSwitcher />
          </div>
          {canDownloadAttestation && (
            <>
              <button
                type="button"
                onClick={openAttestation}
                disabled={attestationLoading}
                style={{
                  width: "100%",
                  background: "none",
                  border: "var(--cam-border-width) solid var(--cam-border-strong)",
                  borderRadius: "var(--cam-radius-sm)",
                  padding: "var(--cam-space-2) var(--cam-space-3)",
                  fontSize: "var(--cam-font-size-sm)",
                  color: "var(--cam-green-dark)",
                  fontWeight: 600,
                  cursor: attestationLoading ? "progress" : "pointer",
                  marginBottom: "var(--cam-space-2)",
                }}
              >
                {attestationLoading ? t("homeLayout.attestationLoading") : t("homeLayout.attestationButton")}
              </button>
              {attestationError && (
                <p
                  role="alert"
                  style={{
                    color: "var(--cam-error)",
                    fontSize: "var(--cam-font-size-2xs)",
                    margin: "0 0 var(--cam-space-2)",
                  }}
                >
                  {attestationError}
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              clearToken();
              router.replace("/");
            }}
            style={{
              width: "100%",
              background: "none",
              border: "var(--cam-border-width) solid var(--cam-border-strong)",
              borderRadius: "var(--cam-radius-sm)",
              padding: "var(--cam-space-2) var(--cam-space-3)",
              fontSize: "var(--cam-font-size-sm)",
              cursor: "pointer",
            }}
          >
            {t("homeLayout.logoutButton")}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "var(--cam-space-6) var(--cam-space-5)", minWidth: 0 }}>
        {meQuery.isLoading && <p>{t("common.loading")}</p>}
        {meQuery.isError && (
          <p role="alert" style={{ color: "var(--cam-error)" }}>
            {(meQuery.error as Error).message}
          </p>
        )}
        {children}
      </main>

      {/* New Declaration Dialog (DSMO vs ONEFOP -> Entity selection) */}
      <NewDeclarationDialog
        isOpen={isNewDeclarationOpen}
        onClose={() => setIsNewDeclarationOpen(false)}
      />
    </div>
  );
}
