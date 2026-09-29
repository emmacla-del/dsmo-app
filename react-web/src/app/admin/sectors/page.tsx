"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSectors } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import type { UserRole } from "@/lib/user-types";

// Phase 1's one low-consequence admin screen (plan's own example: "such as
// regions or sectors"). GET /sectors is public and read-only on the
// backend, so the risk here is genuinely low; access is still gated to
// MINEFOP staff roles since a COMPANY account has no reason to browse the
// sector reference list. There is no equivalent Flutter screen to port —
// sectors only appear today as a lookup inside the company registration
// wizard — so this access policy is a new, deliberately conservative
// product choice for this slice, not a port of existing behavior.
const STAFF_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SUPER_ADMIN_DSMO",
  "SUPER_ADMIN_ONEFOP",
  "DATA_MANAGER",
  "CAMPAIGN_MANAGER",
  "ANALYST",
  "AUDITOR",
  "CENTRAL",
  "REGIONAL",
  "DIVISIONAL",
];

export default function AdminSectorsPage() {
  const t = useTranslations();
  const { isLoading, isAuthenticated, forbidden } = useAdminScreenGuard(STAFF_ROLES);
  const logout = useAuthStore((s) => s.logout);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const sectorsQuery = useQuery({
    queryKey: ["sectors"],
    queryFn: getSectors,
    enabled: isAuthenticated && !forbidden,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of sectorsQuery.data ?? []) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set).sort();
  }, [sectorsQuery.data]);

  const filteredSectors = useMemo(() => {
    const all = sectorsQuery.data ?? [];
    return categoryFilter ? all.filter((s) => s.category === categoryFilter) : all;
  }, [sectorsQuery.data, categoryFilter]);

  // The admin layout already guards the console; these states only cover a
  // role outside STAFF_ROLES reaching the URL directly.
  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <div>
          <h1 className="cam-admin-h1">{t("adminSectorsPage.accessDeniedTitle")}</h1>
          <p className="cam-admin-lede">{t("adminSectorsPage.accessDeniedMessage")}</p>
        </div>
        <div>
          <button className="cam-button cam-button-secondary cam-button-sm" onClick={logout}>
            {t("adminSectorsPage.logoutButton")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      <div className="cam-admin-page-toolbar">
        <div className="cam-field" style={{ margin: 0, minWidth: 220 }}>
          <label className="cam-admin-label" htmlFor="sector-category-filter">
            {t("adminSectorsPage.categoryFilterLabel")}
          </label>
          <select
            id="sector-category-filter"
            className="cam-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t("adminSectorsPage.allCategoriesOption")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {sectorsQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{t("adminSectorsPage.loadErrorMessage")}</span>
        </div>
      )}

      <section className="cam-admin-section">
        <div className="cam-admin-section-head">
          <h2 className="cam-admin-h2">Nomenclature</h2>
          {sectorsQuery.isSuccess && (
            <span className="cam-admin-meta">
              {filteredSectors.length} secteur{filteredSectors.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {sectorsQuery.isLoading ? (
          <p className="cam-admin-empty" style={{ margin: 0 }}>{t("adminSectorsPage.loadingSectors")}</p>
        ) : sectorsQuery.isSuccess && filteredSectors.length === 0 ? (
          <p className="cam-admin-empty" style={{ margin: 0 }}>{t("adminSectorsPage.emptyState")}</p>
        ) : sectorsQuery.isSuccess ? (
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  <th scope="col">{t("adminSectorsPage.columnName")}</th>
                  <th scope="col">{t("adminSectorsPage.columnNameEn")}</th>
                  <th scope="col">{t("adminSectorsPage.columnCategory")}</th>
                  <th scope="col">{t("adminSectorsPage.columnCode")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSectors.map((s) => (
                  <tr key={s.id}>
                    <td className="cam-admin-strong">{s.name}</td>
                    <td className="cam-admin-muted">{s.nameEn ?? "—"}</td>
                    <td>
                      <span className="cam-badge cam-badge-neutral">{s.category ?? "—"}</span>
                    </td>
                    <td>
                      <span className="cam-admin-code">{s.code ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
