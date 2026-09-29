"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getCachedUser, getMe } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { navItemsForRole, resolveEffectiveRole } from "@/lib/role-navigation";

/**
 * Honest "not yet migrated" placeholder for every home_screen.dart
 * destination that has no React implementation yet (see role-navigation.ts
 * — only the ONEFOP declaration entry point is real today). Each
 * destination is meant to migrate independently (Phase 6's per-module
 * retirement model), so this exists to make that gap visible rather than
 * silently 404ing or faking a screen.
 */
export default function HomePlaceholderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useTranslations();
  const authUser = useAuthStore((s) => s.user);
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    initialData: authUser ?? getCachedUser() ?? undefined,
  });
  const user = meQuery.data ?? authUser ?? getCachedUser();
  if (!user) {
    return (
      <div style={{ padding: "var(--cam-space-6)", color: "var(--cam-text-muted)" }}>
        {t("common.loading")}
      </div>
    );
  }

  const effectiveRole = resolveEffectiveRole(user);
  const item = navItemsForRole(effectiveRole).find((i) => i.slug === slug);

  return (
    <div>
      <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-3)" }}>
        {item?.label ?? slug}
      </h1>
      <div
        style={{
          border: "1px dashed var(--cam-border-strong)",
          borderRadius: "var(--cam-radius-md)",
          padding: "var(--cam-space-5)",
          color: "var(--cam-text-muted)",
          fontSize: "var(--cam-font-size-base)",
        }}
      >
        {item
          ? t("homeSlugPage.notMigratedMessage")
          : t("homeSlugPage.unknownSectionMessage")}
      </div>
    </div>
  );
}
