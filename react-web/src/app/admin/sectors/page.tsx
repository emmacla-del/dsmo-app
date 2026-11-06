"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSectors } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { NATIONAL_ROLES } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminFilterPill } from "@/components/admin/AdminFilterPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrefWith } from "@/lib/admin-url";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, resolveDataState } from "@/lib/admin-data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminSectorsPage() {
  return (
    <Suspense fallback={null}>
      <AdminSectorsContent />
    </Suspense>
  );
}

function AdminSectorsContent() {
  const t = useTranslations();
  const { isLoading, isAuthenticated, forbidden } = useAdminScreenGuard(NATIONAL_ROLES);
  const logout = useAuthStore((s) => s.logout);
  // Filters live in the URL (G15): ?q= (name, English name or code) and ?categorie=.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const categoryFilter = searchParams.get("categorie") ?? "";
  const search = searchParams.get("q")?.trim() ?? "";
  const setFilters = (changes: Record<string, string | null>) =>
    router.replace(hrefWith(pathname, currentQuery, changes), { scroll: false });
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (syncedSearch !== search) {
    setSyncedSearch(search);
    setSearchInput(search);
  }
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const timer = setTimeout(() => {
      router.replace(hrefWith(pathname, currentQuery, { q: next || null }), { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, search, router, pathname, currentQuery]);
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
    const needle = search.toLocaleLowerCase();
    return (sectorsQuery.data ?? []).filter((s) =>
      (!categoryFilter || s.category === categoryFilter)
      && (!needle || [s.name, s.nameEn, s.code].some((value) => (value ?? "").toLocaleLowerCase().includes(needle))));
  }, [sectorsQuery.data, categoryFilter, search]);

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
        toolbar={
          <div className="cam-filter-bar" role="group" aria-label={t("adminDossiersPage.filtersButton")}>
            <div className="cam-filter-bar-search">
              <label className="cam-sr-only" htmlFor="sectors-search">{t("adminSectorsPage.searchLabel")}</label>
              <Search aria-hidden="true" className="cam-filter-bar-search-icon" />
              <Input id="sectors-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t("adminSectorsPage.searchPlaceholder")} />
            </div>
            <AdminFilterPill
              label={t("adminSectorsPage.columnCategory")}
              value={categoryFilter}
              allLabel={t("adminSectorsPage.allCategoriesOption")}
              clearLabel={t("adminDossiersPage.removeFilterChip", { label: t("adminSectorsPage.columnCategory") })}
              onChange={(value) => setFilters({ categorie: value || null })}
              options={categories.map((value) => ({ value, label: categoryLabel(value) }))}
            />
            {(search || categoryFilter) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setSearchInput(""); setFilters({ q: null, categorie: null }); }}>
                {t("adminDossiersPage.clearFilters")}
              </Button>
            )}
          </div>
        }
      >
        <Table className="cam-admin-data-table">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("adminSectorsPage.columnName")}</TableHead>
              <TableHead scope="col">{t("adminSectorsPage.columnNameEn")}</TableHead>
              <TableHead scope="col">{t("adminSectorsPage.columnCategory")}</TableHead>
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
