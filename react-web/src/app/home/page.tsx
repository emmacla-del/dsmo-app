"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getCachedUser, getMe } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { navItemsForRole, resolveEffectiveRole, roleLabel } from "@/lib/role-navigation";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";

export default function HomeLandingPage() {
  const t = useTranslations();
  const authUser = useAuthStore((s) => s.user);
  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: getMe, initialData: authUser ?? getCachedUser() ?? undefined });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const user = meQuery.data ?? authUser ?? getCachedUser();
  if (!user) {
    return (
      <div style={{ padding: "var(--cam-space-6)", color: "var(--cam-text-muted)" }}>
        {t("common.loading")}
      </div>
    );
  }

  const effectiveRole = resolveEffectiveRole(user);
  const items = navItemsForRole(effectiveRole);

  return (
    <div>
      <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" }}>
        {t("homeLandingPage.welcomeTitle")}
      </h1>
      <p style={{ color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-5)" }}>
        {t("homeLandingPage.sectionsAvailable", { role: roleLabel(effectiveRole), count: items.length })}
      </p>

      {user.role !== "COMPANY" && (
        <div
          style={{
            background: "var(--cam-surface)",
            border: "1px solid var(--cam-border)",
            borderRadius: 12,
            padding: 24,
            maxWidth: 680,
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🏛️</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
              Console Ministérielle MINEFOP · ONEFOP
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "var(--cam-text-muted)", margin: "0 0 16px", lineHeight: 1.4 }}>
            Accédez directement aux quatre outils d'instruction, d'arbitrage de qualité et de diffusion statistique.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Link
              href="/admin/pilotage"
              style={{
                display: "block",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--cam-border)",
                background: "var(--cam-bg)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cam-green)" }}>Tableau de Bord National</div>
              <div style={{ fontSize: 12, color: "var(--cam-text-muted)", marginTop: 2 }}>Indicateurs de performance</div>
            </Link>
            <Link
              href="/admin/files-attente"
              style={{
                display: "block",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--cam-border)",
                background: "var(--cam-bg)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cam-warning)" }}>Dossiers en Instance</div>
              <div style={{ fontSize: 12, color: "var(--cam-text-muted)", marginTop: 2 }}>File de traitement prioritaire</div>
            </Link>
            <Link
              href="/admin/dossiers"
              style={{
                display: "block",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--cam-border)",
                background: "var(--cam-bg)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cam-info)" }}>Instruction & Visas</div>
              <div style={{ fontSize: 12, color: "var(--cam-text-muted)", marginTop: 2 }}>Contrôle de conformité & arbitrage</div>
            </Link>
            <Link
              href="/admin/diffusion"
              style={{
                display: "block",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--cam-border)",
                background: "var(--cam-bg)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cam-green)" }}>Statistiques & Diffusion</div>
              <div style={{ fontSize: 12, color: "var(--cam-text-muted)", marginTop: 2 }}>Agrégats consolidés & exportations</div>
            </Link>
          </div>
        </div>
      )}

      {user.role === "COMPANY" && (
        <div
          style={{
            background: "var(--cam-surface)",
            border: "1px solid var(--cam-border)",
            borderRadius: 12,
            padding: 24,
            maxWidth: 680,
            marginTop: 20,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: "var(--cam-text)" }}>
            {t("homeLandingPage.newDeclarationHeading")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--cam-text-muted)", margin: "0 0 16px", lineHeight: 1.4 }}>
            {t("homeLandingPage.newDeclarationDesc")}
          </p>
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="cam-button cam-button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13 }}
          >
            <span style={{ fontSize: 16 }}>＋</span>
            {t("homeLandingPage.startDeclarationButton")}
          </button>
        </div>
      )}

      <NewDeclarationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
