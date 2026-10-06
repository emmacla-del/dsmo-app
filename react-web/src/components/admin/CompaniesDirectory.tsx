"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  type Company,
  contactValue,
  dash,
  entityTypeLabel,
  formatDate,
  genderBreakdown,
  hasRealNiu,
  listCompanies,
} from "@/lib/companies-directory";

const PAGE_SIZE = 20;

interface Column {
  key: string;
  labelKey: string;
  compare: (a: Company, b: Company) => number;
  render: (c: Company) => React.ReactNode;
}

function useColumns(t: ReturnType<typeof useTranslations>): Column[] {
  return [
    {
      key: "name",
      labelKey: "companiesDirectory.nameColumn",
      compare: (a, b) => (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase()),
      render: (c) => dash(c.name),
    },
    {
      key: "type",
      labelKey: "companiesDirectory.typeColumn",
      compare: (a, b) => entityTypeLabel(a.entityType).localeCompare(entityTypeLabel(b.entityType)),
      render: (c) => dash(entityTypeLabel(c.entityType)),
    },
    {
      key: "niu",
      labelKey: "companiesDirectory.niuColumn",
      compare: (a, b) => (a.taxNumber ?? "").localeCompare(b.taxNumber ?? ""),
      render: (c) => dash(hasRealNiu(c.taxNumber) ? c.taxNumber : null),
    },
    {
      key: "establishmentId",
      labelKey: "companiesDirectory.establishmentIdColumn",
      compare: (a, b) => (a.establishmentId ?? "").localeCompare(b.establishmentId ?? ""),
      render: (c) => dash(c.establishmentId),
    },
    {
      key: "region",
      labelKey: "companiesDirectory.regionColumn",
      compare: (a, b) => (a.region ?? "").localeCompare(b.region ?? ""),
      render: (c) => dash(c.region),
    },
    {
      key: "department",
      labelKey: "companiesDirectory.departmentColumn",
      compare: (a, b) => (a.department ?? "").localeCompare(b.department ?? ""),
      render: (c) => dash(c.department),
    },
    {
      key: "createdAt",
      labelKey: "companiesDirectory.createdAtColumn",
      compare: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (c) => formatDate(c.createdAt),
    },
    {
      key: "contact",
      labelKey: "companiesDirectory.contactColumn",
      compare: (a, b) => contactValue(a).toLowerCase().localeCompare(contactValue(b).toLowerCase()),
      render: (c) => dash(contactValue(c)),
    },
    {
      key: "status",
      labelKey: "companiesDirectory.statusColumn",
      compare: (a, b) => Number(a.user?.isActive ?? false) - Number(b.user?.isActive ?? false),
      render: (c) => (
        <span className={c.user?.isActive ? "cam-badge cam-badge-success" : "cam-badge cam-badge-error"}>
          {c.user?.isActive ? t("companiesDirectory.statusActive") : t("companiesDirectory.statusSuspended")}
        </span>
      ),
    },
  ];
}

export function CompaniesDirectory() {
  const t = useTranslations();
  const COLUMNS = useColumns(t);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ index: number; ascending: boolean } | null>(null);
  const [selected, setSelected] = useState<Company | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["dsmo", "companies", search, page],
    queryFn: () => listCompanies({ search, page, pageSize: PAGE_SIZE }),
  });

  const sortedCompanies = useMemo(() => {
    const list = query.data?.companies ?? [];
    if (!sort) return list;
    const { index, ascending } = sort;
    const sorted = [...list].sort((a, b) => COLUMNS[index].compare(a, b));
    return ascending ? sorted : sorted.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, sort]);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (selected) dialogRef.current?.showModal();
    else {
      try { dialogRef.current?.close(); } catch { /* already closed */ }
    }
  }, [selected]);

  return (
    <div>
      {/* Search row */}
      <div style={{ display: "flex", gap: "var(--cam-space-3)", marginBottom: "var(--cam-space-3)" }}>
        <div className="cam-admin-search" style={{ flex: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("companiesDirectory.searchPlaceholder")}
            className="cam-input"
          />
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="cam-button cam-button-secondary cam-button-sm"
          style={{ flexShrink: 0 }}
        >
          {t("companiesDirectory.refresh")}
        </button>
      </div>

      <p className="cam-admin-meta" style={{ marginBottom: "var(--cam-space-3)" }}>
        {t("companiesDirectory.resultsCount", { count: total })}
      </p>

      {query.isLoading && <p>{t("common.loading")}</p>}
      {query.isError && (
        <div role="alert" style={{ color: "var(--cam-error)", fontSize: "var(--cam-font-size-sm)" }}>
          {t("companiesDirectory.loadError", { error: (query.error as Error).message })}
          <button type="button" onClick={() => query.refetch()} className="cam-text-button" style={{ marginLeft: "var(--cam-space-3)" }}>
            {t("common.retry")}
          </button>
        </div>
      )}
      {query.data && sortedCompanies.length === 0 && (
        <p className="cam-admin-meta">{t("companiesDirectory.emptyState")}</p>
      )}

      {query.data && sortedCompanies.length > 0 && (
        <>
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  {COLUMNS.map((col, i) => (
                    <th
                      key={col.key}
                      scope="col"
                      style={{ cursor: "pointer", userSelect: "none" }}
                      onClick={() =>
                        setSort((prev) => ({
                          index: i,
                          ascending: prev?.index === i ? !prev.ascending : true,
                        }))
                      }
                    >
                      {t(col.labelKey)}
                      {sort?.index === i ? (sort.ascending ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCompanies.map((c) => (
                  <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor: "pointer" }}>
                    {COLUMNS.map((col) => (
                      <td key={col.key}>{col.render(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cam-pagination">
            <button className="cam-pagination-btn" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("companiesDirectory.prevPage")}
            </button>
            <span className="cam-pagination-info">
              {t("companiesDirectory.pageIndicator", { page, totalPages })}
            </span>
            <button className="cam-pagination-btn" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t("companiesDirectory.nextPage")}
            </button>
          </div>
        </>
      )}

      <dialog
        ref={dialogRef}
        className="cam-admin-dialog"
        onClose={() => setSelected(null)}
      >
        {selected && <CompanyDetail company={selected} onClose={() => setSelected(null)} />}
      </dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <>
      <dt className="cam-admin-meta" style={{ padding: "5px 0", margin: 0 }}>{label}</dt>
      <dd className="cam-admin-strong" style={{ margin: 0, padding: "5px 0", wordBreak: "break-word" }}>{value}</dd>
    </>
  );
}

function DetailSection({ title, rows }: { title: string; rows: [string, string | null | undefined][] }) {
  const present = rows.filter(([, v]) => v);
  if (present.length === 0) return null;
  return (
    <div>
      <h3 className="cam-admin-dialog-eyebrow" style={{ margin: "0 0 var(--cam-space-2)" }}>{title}</h3>
      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "140px 1fr",
          rowGap: 0,
          borderTop: "var(--cam-border-width) solid var(--cam-border)",
        }}
      >
        {present.map(([label, value]) => (
          <DetailRow key={label} label={label} value={value} />
        ))}
      </dl>
    </div>
  );
}

function CompanyDetail({ company: c, onClose }: { company: Company; onClose: () => void }) {
  const t = useTranslations();
  const respondentName = [c.respondentFirstName, c.respondentLastName].filter(Boolean).join(" ");

  return (
    <>
      <div className="cam-admin-dialog-head">
        <div style={{ minWidth: 0 }}>
          <p className="cam-admin-dialog-eyebrow" style={{ margin: "0 0 4px" }}>
            {entityTypeLabel(c.entityType) || "Établissement"}
          </p>
          <h2 className="cam-admin-dialog-title">{c.name ?? "—"}</h2>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--cam-space-2)", marginTop: "var(--cam-space-1)" }}>
            {c.establishmentId && (
              <code className="cam-admin-code cam-admin-muted">{c.establishmentId}</code>
            )}
            <span className={c.user?.isActive ? "cam-badge cam-badge-success" : "cam-badge cam-badge-error"}>
              {c.user?.isActive
                ? t("companiesDirectory.statusActive")
                : t("companiesDirectory.statusSuspended")}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="cam-admin-dialog-close"
          onClick={onClose}
          aria-label={t("companiesDirectory.closeAriaLabel")}
        >
          ×
        </button>
      </div>

      <div className="cam-admin-dialog-body">
        <DetailSection
          title={t("companiesDirectory.sectionIdentity")}
          rows={[
            [t("companiesDirectory.niuColumn"), hasRealNiu(c.taxNumber) ? c.taxNumber : null],
            [t("companiesDirectory.entityTypeLabel"), entityTypeLabel(c.entityType) || null],
            [t("companiesDirectory.sectorLabel"), c.sector?.name],
            [t("companiesDirectory.mainActivityLabel"), c.mainActivity],
            [t("companiesDirectory.legalStatusLabel"), c.legalStatus],
            [t("companiesDirectory.registrationNumberLabel"), c.registrationNumber],
            [t("companiesDirectory.cnpsNumberLabel"), c.cnpsNumber],
            [t("companiesDirectory.yearOfCreationLabel"), c.yearOfCreation],
            [t("companiesDirectory.enterpriseSizeLabel"), c.enterpriseSize],
            [t("companiesDirectory.registeredOnLabel"), formatDate(c.createdAt)],
          ]}
        />
        <DetailSection
          title={t("companiesDirectory.sectionLocation")}
          rows={[
            [t("companiesDirectory.regionColumn"), c.region],
            [t("companiesDirectory.departmentColumn"), c.department],
            [t("companiesDirectory.subdivisionLabel"), c.subdivision],
            [t("companiesDirectory.addressLabel"), c.address],
          ]}
        />
        <DetailSection
          title={t("companiesDirectory.sectionCompanyContact")}
          rows={[
            [t("companiesDirectory.phoneLabel"), c.phone],
            [t("companiesDirectory.accountEmailLabel"), c.user?.email],
            [t("companiesDirectory.accountStatusLabel"),
              c.user
                ? (c.user.isActive
                    ? t("companiesDirectory.statusActive")
                    : t("companiesDirectory.statusSuspended"))
                : null,
            ],
          ]}
        />
        <DetailSection
          title={t("companiesDirectory.sectionRespondent")}
          rows={[
            [t("companiesDirectory.nameColumn"), respondentName || null],
            [t("companiesDirectory.functionLabel"), c.respondentFunction],
            [t("companiesDirectory.phoneLabel"), c.respondentPhone],
          ]}
        />
        <DetailSection
          title={t("companiesDirectory.sectionWorkforce")}
          rows={[
            [t("companiesDirectory.totalWorkforceLabel"), c.totalEmployees?.toString()],
            [t("companiesDirectory.breakdownLabel"), genderBreakdown(c.menCount, c.womenCount)],
            [t("companiesDirectory.previousYearTotalLabel"), c.lastYearTotal?.toString()],
            [t("companiesDirectory.previousYearBreakdownLabel"), genderBreakdown(c.lastYearMenCount, c.lastYearWomenCount)],
          ]}
        />
      </div>

      <div className="cam-admin-dialog-foot">
        <button type="button" onClick={onClose} className="cam-button cam-button-secondary cam-button-sm">
          Fermer
        </button>
      </div>
    </>
  );
}
