"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getCachedUser } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { navItemsForRole, resolveEffectiveRole } from "@/lib/role-navigation";
import { meQueryOptions } from "@/lib/shared-queries";

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
    ...meQueryOptions,
    initialData: authUser ?? getCachedUser() ?? undefined,
  });
  const user = meQuery.data ?? authUser ?? getCachedUser();
  if (!user) {
    return (
      <p className="cam-home-state">{t("common.loading")}</p>
    );
  }

  const effectiveRole = resolveEffectiveRole(user);
  const item = navItemsForRole(effectiveRole).find((i) => i.slug === slug);

  return (
    <div className="cam-home-page">
      <header className="cam-home-head">
        <h1 className="cam-home-title">{item ? t(item.labelKey) : slug}</h1>
      </header>
      <p className="cam-home-state">
        {item
          ? t("homeSlugPage.notMigratedMessage")
          : t("homeSlugPage.unknownSectionMessage")}
      </p>
    </div>
  );
}
