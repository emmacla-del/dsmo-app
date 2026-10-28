"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSectors } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { NATIONAL_ROLES } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { FilterTableHead, FilterTableOptions } from "@/components/admin/FilterTableHead";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, resolveDataState } from "@/lib/admin-data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminSectorsPage() {
  const t = useTranslations();
  const { isLoading, isAuthenticated, forbidden } = useAdminScreenGuard(NATIONAL_ROLES);
  const logout = useAuthStore((s) => s.logout);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  // The stored category is an English word (Primary, Tertiary…); shown in the
  // interface language. An unknown value is shown as stored.
  const tCategory = useTranslations("adminSectorsPage.category");
  const categoryLabel = (c: string) => (tCategory.has(c) ? tCategory(c) : c);

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
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => logout()}>
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

      <AdminTablePanel
        title={t("adminNav.routes.sectors")}
        headingId="sectors-table-title"
        meta={sectorsQuery.isSuccess ? t("adminSectorsPage.sectorCount", { count: filteredSectors.length }) : undefined}
      >
        <Table className="cam-admin-data-table">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("adminSectorsPage.columnName")}</TableHead>
              <TableHead scope="col">{t("adminSectorsPage.columnNameEn")}</TableHead>
              <FilterTableHead label={t("adminSectorsPage.columnCategory")} filterLabel={t("adminSectorsPage.categoryFilterLabel")} active={!!categoryFilter}>
                {(close) => <FilterTableOptions label={t("adminSectorsPage.categoryFilterLabel")} value={categoryFilter} options={[{ value: "", label: t("adminSectorsPage.allCategoriesOption") }, ...categories.map((value) => ({ value, label: categoryLabel(value) }))]} onChange={setCategoryFilter} onSelect={close} />}
              </FilterTableHead>
              <TableHead scope="col">{t("adminSectorsPage.columnCode")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.nameEn ?? NOT_PROVIDED}</TableCell>
                  <TableCell>
                    <span className="cam-badge cam-badge-neutral">{s.category ? categoryLabel(s.category) : NOT_PROVIDED}</span>
                  </TableCell>
                  <TableCell><span className="cam-admin-code">{s.code ?? NOT_PROVIDED}</span></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </AdminTablePanel>
    </div>
  );
}
