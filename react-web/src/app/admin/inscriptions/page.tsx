"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { RegistrationQueue } from "@/components/admin/RegistrationQueue";
import { DataState } from "@/components/admin/DataState";
import { legacyOrganisationsDestination } from "@/lib/inscriptions";
import { coverageHref } from "@/lib/pilotage-targets";

export default function InscriptionsPage() {
  return (
    <Suspense fallback={<InscriptionsLoading />}>
      <InscriptionsRoute />
    </Suspense>
  );
}

function InscriptionsLoading() {
  const t = useTranslations("adminRegistrationQueue");
  const tRoot = useTranslations();
  return (
    <div className="cam-admin-page">
      <DataState state="loading" resource={t("resource")} title={tRoot("common.loading")} />
    </div>
  );
}

function InscriptionsRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("vue");
  const legacyCoverage = rawView === "coverage" || rawView === "couverture";
  const legacyOrganisations = rawView === "organisations";

  useEffect(() => {
    if (legacyCoverage) {
      router.replace(coverageHref(
        searchParams.get("annee") ?? searchParams.get("periode"),
        searchParams.get("semestre"),
        searchParams.get("trimestre"),
      ));
    } else if (legacyOrganisations) {
      router.replace(legacyOrganisationsDestination(new URLSearchParams(searchParams.toString())));
    }
  }, [legacyCoverage, legacyOrganisations, router, searchParams]);

  if (legacyCoverage || legacyOrganisations) return <InscriptionsLoading />;
  return <RegistrationQueue />;
}
