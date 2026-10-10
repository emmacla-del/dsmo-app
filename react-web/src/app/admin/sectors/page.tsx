"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSectors } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { NATIONAL_ROLES } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, resolveDataState } from "@/lib/admin-data-state";

export default function AdminSectorsPage() {
  const t = useTranslations();
  const { isLoading, isAuthenticated, forbidden } = useAdminScreenGuard(NATIONAL_ROLES);
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

  const header = (
    <AdminPageHeader
      breadcrumb={[{ label: t("adminNav.hubs.donnees") }, { label: t("adminNav.routes.sectors") }]}
      title={t("adminNav.routes.sectors")}
      subtitle={t("adminLayout.sectorsSubtitle")}
      actions={<AdminHeaderActions showCampaignPill={false} />}
    />
  );

  // The admin layout already guards the console; these states only cover a
  // role outside STAFF_ROLES reaching the URL directly. Both keep the page
  // chrome rather than rendering nothing or a hand-built heading.
  if (isLoading || forbidden) {
    return (
      <div className="cam-admin-page">
        {header}
        <DataState
          state={isLoading ? "loading" : "forbidden"}
          resource={t("adminNav.routes.sectors")}
          title={isLoading ? t("common.loading") : t("adminSectorsPage.accessDeniedTitle")}
          hint={forbidden ? t("adminSectorsPage.accessDeniedMessage") : undefined}
        />
        {forbidden && (
          <div>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={logout}>
              {t("adminSectorsPage.logoutButton")}
            </button>
          </div>
        )}
      </div>
    );
  }

  const tableState = resolveDataState({
    isLoading: sectorsQuery.isLoading,
    isError: sectorsQuery.isError,
    error: sectorsQuery.error,
    rowCount: sectorsQuery.data ? filteredSectors.length : null,
  });

  return (
    <div className="cam-admin-page">
      {header}

      <section className="cam-admin-section">
        <div className="cam-admin-section-head">
          {sectorsQuery.isSuccess && (
            <span className="cam-admin-meta">
              {t("adminSectorsPage.sectorCount", { count: filteredSectors.length })}
            </span>
          )}
        </div>
        <div className="cam-admin-section-body">
          <div className="cam-admin-filters">
            <div className="cam-field">
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
        </div>
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
              {/* Loading, failure and "no sector in this category" are three
                  distinct renders. */}
              <DataStateRow
                colSpan={4}
                state={tableState}
                resource={t("adminNav.routes.sectors")}
                error={sectorsQuery.error}
                onRetry={() => sectorsQuery.refetch()}
                title={
                  tableState === "loading"
                    ? t("adminSectorsPage.loadingSectors")
                    : tableState === "error"
                      ? t("adminSectorsPage.loadErrorMessage")
                      : tableState === "empty"
                        ? t("adminSectorsPage.emptyState")
                        : undefined
                }
              />
              {tableState === "ready" && filteredSectors.map((s) => (
                <tr key={s.id}>
                  <td className="cam-admin-strong">{s.name}</td>
                  <td className="cam-admin-muted">{s.nameEn ?? NOT_PROVIDED}</td>
                  <td>
                    <span className="cam-badge cam-badge-neutral">{s.category ?? NOT_PROVIDED}</span>
                  </td>
                  <td>
                    <span className="cam-admin-code">{s.code ?? NOT_PROVIDED}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
