"use client";

import { useTranslations } from "next-intl";
import React from "react";
import type { FormData, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { isFieldVisible } from "@/lib/onefop-schema";
import { OPTIONAL_OVERRIDES, type ValidationIssue } from "@/lib/onefop-validation";
import { FormGrid, FormCol } from "@/components/onefop/ui/FormGrid";
import { FormSectionCard } from "@/components/onefop/ui/FormSectionCard";
import type { FormStatus } from "@/components/onefop/form/StatusChip";
import { FieldRenderer } from "@/components/onefop/FieldRenderer";
import { CameroonGeographySelector } from "@/components/modern-jobs/geography/CameroonGeographySelector";
import { ConditionalField } from "@/components/modern-jobs/conditional/ConditionalField";

export interface Section1ThematicRendererProps {
  section: OnefopSection;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issues?: ValidationIssue[];
  locale?: "fr" | "en";
  touchedFields?: Set<string>;
  onFieldTouch?: (fieldId: string) => void;
  attemptedContinue?: boolean;
}

export type ThematicCardId = "identity" | "location" | "contact" | "activity";

/** Card order; titles and descriptions live in messages (modernJobs.section1.cards.<id>). */
export interface ThematicCardConfig {
  id: ThematicCardId;
}

export const THEMATIC_CARDS: ThematicCardConfig[] = [
  { id: "identity" },
  { id: "location" },
  { id: "contact" },
  { id: "activity" },
];

export function classifySection1Field(fieldId: string): ThematicCardId {
  const id = fieldId.toUpperCase();

  // Location: Milieu de résidence & Cameroon geographic hierarchy
  if (
    id.includes("_REGION") ||
    id.includes("_DEPT") ||
    id.includes("_SUBDIV") ||
    id.includes("_LOCALITY") ||
    id === "S1Q03" ||
    id === "COOP_S1Q04" ||
    id === "CTD_S1Q04" ||
    id === "ONG_S1Q04" ||
    id === "ADMIN_S1Q03" ||
    id === "PP_S1Q05" ||
    id === "VT1_8_REGION" ||
    id === "VT1_8_DEPT" ||
    id === "VT1_8_SUBDIV" ||
    id === "VT1_8_LOCALITY" ||
    id === "VT1_9"
  ) {
    return "location";
  }

  // Contact: Phones, Postal Box, Email
  if (
    id.includes("_TEL") ||
    id.includes("_BP") ||
    id.includes("_EMAIL") ||
    id.includes("_FAX") ||
    id.includes("VT1_10") ||
    id.includes("VT1_11") ||
    id.includes("VT1_15_TEL") ||
    id.includes("VT1_15_EMAIL") ||
    id.includes("VT1_16_TEL") ||
    id.includes("VT1_16_EMAIL")
  ) {
    return "contact";
  }

  // Activity & Overall Workforce: Sectors, Branches, Missions, Permanent staff counts, Vacancies
  if (
    id.includes("SECTEUR") ||
    id.includes("BRANCHE") ||
    id.includes("ACTIVITE") ||
    id.includes("MISSION") ||
    id.includes("OBJECTIF") ||
    id.includes("EMPLOYE") ||
    id.includes("POSTE") ||
    id.includes("TAILLE") ||
    id === "S1Q06" ||
    id === "S1Q07" ||
    id === "S1Q08" ||
    id === "S1Q10" ||
    id === "S1Q11" ||
    id === "S1Q12" ||
    id === "COOP_S1Q07" ||
    id === "COOP_S1Q08" ||
    id === "COOP_S1Q09" ||
    id === "COOP_S1Q11" ||
    id === "COOP_S1Q12" ||
    id === "CTD_S1Q07" ||
    id === "CTD_S1Q08" ||
    id === "CTD_S1Q09" ||
    id === "CTD_S1Q10" ||
    id === "ONG_S1Q07" ||
    id === "ONG_S1Q08" ||
    id === "ONG_S1Q09" ||
    id === "ONG_S1Q10" ||
    id === "ONG_S1Q11" ||
    id === "ADMIN_S1Q06" ||
    id === "ADMIN_S1Q07" ||
    id === "ADMIN_S1Q08" ||
    id === "ADMIN_S1Q09" ||
    id === "ADMIN_S1Q10" ||
    id === "PP_S1Q08" ||
    id === "PP_S1Q09" ||
    id === "PP_S1Q10" ||
    id === "PP_S1Q13" ||
    id === "PP_S1Q14" ||
    id === "PP_S1Q15" ||
    id === "PP_S1Q16" ||
    id === "VT1_12" ||
    id === "VT1_13" ||
    id === "VT1_13_OTHER" ||
    id === "VT1_14"
  ) {
    return "activity";
  }

  // Identity (Default): Name, Acronym, Legal status, Year of creation, Supervisory structure
  return "identity";
}

export function getFieldSpan(field: OnefopField): 1 | 2 | 3 | "full" {
  if (field.id.endsWith("_REGION")) return "full";
  if (field.type === "textarea") return "full";
  if (field.type === "radio" || field.type === "checkbox") {
    return field.options && field.options.length <= 3 ? 2 : "full";
  }
  if (
    field.type === "text" ||
    field.type === "number" ||
    field.type === "tel" ||
    field.type === "email"
  ) {
    return 1;
  }
  return 2;
}

export interface Section1ThemeSummary {
  config: ThematicCardConfig;
  fields: OnefopField[];
  visibleFields: OnefopField[];
  requiredVisibleFields: OnefopField[];
  allRequiredFilled: boolean;
  hasErrors: boolean;
  status: FormStatus;
}

export function getSection1ThematicInventory(
  section: OnefopSection,
  data: FormData,
  issues: ValidationIssue[] = [],
  touchedFields?: Set<string>,
  attemptedContinue: boolean = false
): Section1ThemeSummary[] {
  const issueByFieldId = new Map(issues.map((issue) => [issue.fieldId, issue.message]));

  const fieldsByCard: Record<ThematicCardId, OnefopField[]> = {
    identity: [],
    location: [],
    contact: [],
    activity: [],
  };

  for (const field of section.fields) {
    const cardId = classifySection1Field(field.id);
    fieldsByCard[cardId].push(field);
  }

  return THEMATIC_CARDS.map((cardConfig) => {
    const fields = fieldsByCard[cardConfig.id] || [];
    const visibleFields = fields.filter((f) => isFieldVisible(f, data));

    const requiredVisibleFields = visibleFields.filter(
      (f) => f.required && !OPTIONAL_OVERRIDES.has(f.id)
    );

    const allRequiredFilled =
      requiredVisibleFields.length > 0
        ? requiredVisibleFields.every((f) => {
            const val = data[f.id];
            return val !== undefined && val !== null && String(val).trim() !== "";
          })
        : visibleFields.length > 0 &&
          visibleFields.some((f) => {
            const val = data[f.id];
            return val !== undefined && val !== null && String(val).trim() !== "";
          });

    const hasErrors = fields.some(
      (f) => (attemptedContinue || touchedFields?.has(f.id)) && issueByFieldId.has(f.id)
    );
    const hasAnyFilled = fields.some((f) => {
      const val = data[f.id];
      return val !== undefined && val !== null && String(val).trim() !== "";
    });

    const status: FormStatus = hasErrors
      ? "has-errors"
      : allRequiredFilled
      ? "complete"
      : hasAnyFilled
      ? "in-progress"
      : "not-started";

    return {
      config: cardConfig,
      fields,
      visibleFields,
      requiredVisibleFields,
      allRequiredFilled,
      hasErrors,
      status,
    };
  });
}

export function Section1ThematicRenderer({
  section,
  data,
  onChange,
  issues = [],
  locale = "fr",
  touchedFields,
  onFieldTouch,
  attemptedContinue = false,
}: Section1ThematicRendererProps) {
  const t = useTranslations("modernJobs.section1");
  const issueByFieldId = new Map(issues.map((issue) => [issue.fieldId, issue.message]));
  const thematicSummaries = getSection1ThematicInventory(
    section,
    data,
    issues,
    touchedFields,
    attemptedContinue
  );

  const shouldShowError = (fieldId: string) => {
    return (touchedFields?.has(fieldId) || attemptedContinue) && issueByFieldId.has(fieldId);
  };

  return (
    <div
      className="section1-thematic-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--cam-space-5, 20px)",
        maxWidth: 780,
        width: "100%",
        boxSizing: "border-box",
      }}
      data-testid="section1-thematic-container"
    >
      {/* ── Thematic Cards ── */}
      {thematicSummaries.map((summary) => {
        const { config, fields: cardFields, status: cardStatus } = summary;
        const cardStatusLabel = t(`status.${cardStatus}`);
        if (!cardFields || cardFields.length === 0) return null;

        const title = t(`cards.${config.id}.title`);
        const description = t(`cards.${config.id}.description`);

        // Helper to check if field is downstream geography
        const isDownstreamGeo = (f: OnefopField) =>
          f.id.endsWith("_DEPT") || f.id.endsWith("_SUBDIV") || f.id.endsWith("_LOCALITY");

        return (
          <FormSectionCard
            key={config.id}
            id={`thematic-${config.id}`}
            title={title}
            status={cardStatus}
            statusLabel={cardStatusLabel}
          >
            <p
              style={{
                fontSize: 13,
                color: "var(--cam-text-muted, #64748b)",
                marginTop: -4,
                marginBottom: 16,
                lineHeight: 1.4,
              }}
            >
              {description}
            </p>

            {(() => {
              // Helper to render a field with delayed validation
              const renderField = (field: OnefopField, noBottomMargin = false, controlMaxWidth?: number) => {
                const err = shouldShowError(field.id) ? issueByFieldId.get(field.id) : undefined;
                return (
                  <ConditionalField key={field.id} field={field} data={data}>
                    <FieldRenderer
                      field={field}
                      value={data[field.id]}
                      data={data}
                      onChange={onChange}
                      sectionId={section.id}
                      errorMessage={err}
                      onFieldTouch={onFieldTouch}
                      noBottomMargin={noBottomMargin}
                      controlMaxWidth={controlMaxWidth}
                    />
                  </ConditionalField>
                );
              };

              const renderableFields = cardFields.filter((f) => !isDownstreamGeo(f));

              if (config.id === "identity") {
                const yearFields = renderableFields.filter((f) => {
                  const id = f.id.toUpperCase();
                  return (
                    f.type === "number" ||
                    id.includes("YEAR") ||
                    id.includes("CREATION") ||
                    id.includes("ANNEE")
                  );
                });
                const radioFields = renderableFields.filter(
                  (f) => f.type === "radio" || f.type === "checkbox"
                );
                const textFields = renderableFields.filter(
                  (f) => !yearFields.includes(f) && !radioFields.includes(f)
                );

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {textFields.map((f) => (
                      <div key={f.id} style={{ width: "100%" }}>
                        {renderField(f)}
                      </div>
                    ))}

                    {yearFields.map((f) => (
                      <div key={f.id} style={{ width: "100%" }}>
                        {renderField(f, false, 180)}
                      </div>
                    ))}

                    {radioFields.map((f) => (
                      <div key={f.id} style={{ width: "100%" }}>
                        {renderField(f)}
                      </div>
                    ))}
                  </div>
                );
              }

              if (config.id === "location") {
                const milieuField = renderableFields.find((f) => {
                  const id = f.id.toUpperCase();
                  return (
                    id.includes("MILIEU") ||
                    id === "COOP_S1Q04" ||
                    id === "CTD_S1Q04" ||
                    id === "ONG_S1Q04" ||
                    id === "ADMIN_S1Q03" ||
                    id === "PP_S1Q05" ||
                    id === "S1Q03"
                  );
                });
                const regionField = renderableFields.find((f) => f.id.endsWith("_REGION"));
                const otherFields = renderableFields.filter(
                  (f) => f !== milieuField && f !== regionField
                );

                const prefix = regionField ? regionField.id.replace(/_REGION$/, "") : "";
                const deptFieldId = `${prefix}_DEPT`;
                const subdivFieldId = `${prefix}_SUBDIV`;
                const localityFieldId = `${prefix}_LOCALITY`;
                const hasLocality = cardFields.some((f) => f.id === localityFieldId);

                const geoErrors: Record<string, string> = {};
                if (regionField && shouldShowError(regionField.id) && issueByFieldId.has(regionField.id)) {
                  geoErrors[regionField.id] = issueByFieldId.get(regionField.id)!;
                }
                if (shouldShowError(deptFieldId) && issueByFieldId.has(deptFieldId)) {
                  geoErrors[deptFieldId] = issueByFieldId.get(deptFieldId)!;
                }
                if (shouldShowError(subdivFieldId) && issueByFieldId.has(subdivFieldId)) {
                  geoErrors[subdivFieldId] = issueByFieldId.get(subdivFieldId)!;
                }
                if (hasLocality && shouldShowError(localityFieldId) && issueByFieldId.has(localityFieldId)) {
                  geoErrors[localityFieldId] = issueByFieldId.get(localityFieldId)!;
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {milieuField && <div>{renderField(milieuField)}</div>}

                    {regionField && (
                      <div style={{ paddingTop: 14, borderTop: "0.5px solid var(--border, #e2e8f0)" }}>
                        <CameroonGeographySelector
                          regionFieldId={regionField.id}
                          departmentFieldId={deptFieldId}
                          subdivisionFieldId={subdivFieldId}
                          localityFieldId={hasLocality ? localityFieldId : undefined}
                          data={data}
                          onChange={onChange}
                          locale={locale}
                          required={regionField.required}
                          errors={geoErrors}
                        />
                      </div>
                    )}

                    {otherFields.map((f) => (
                      <div key={f.id} style={{ width: "100%" }}>
                        {renderField(f)}
                      </div>
                    ))}
                  </div>
                );
              }

              if (config.id === "contact") {
                const shortFields = renderableFields.filter((f) => {
                  const id = f.id.toUpperCase();
                  return (
                    id.includes("TEL") ||
                    id.includes("BP") ||
                    id.includes("POBOX") ||
                    id.includes("FAX")
                  );
                });
                const longFields = renderableFields.filter((f) => !shortFields.includes(f));

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {shortFields.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          // As many columns as fit with room for a one-line question.
                          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                          gap: 12,
                        }}
                      >
                        {shortFields.map((f) => (
                          <div key={f.id} style={{ display: "contents" }}>{renderField(f, true)}</div>
                        ))}
                      </div>
                    )}

                    {longFields.map((f) => (
                      <div key={f.id} style={{ width: "100%" }}>
                        {renderField(f)}
                      </div>
                    ))}
                  </div>
                );
              }

              if (config.id === "activity") {
                // Schema order is kept; consecutive number questions (staff,
                // vacancies…) share one row, everything else takes a full line.
                const groups: OnefopField[][] = [];
                for (const f of renderableFields) {
                  const last = groups[groups.length - 1];
                  if (f.type === "number" && last && last[0].type === "number") last.push(f);
                  else groups.push([f]);
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {groups.map((group) =>
                      group.length > 1 ? (
                        // Each column is as wide as its question (never wrapped);
                        // stacked on narrow screens.
                        <div
                          key={group[0].id}
                          className="grid grid-cols-1 gap-y-3 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-max sm:gap-x-10"
                        >
                          {group.map((f) => (
                            <div key={f.id} style={{ display: "contents" }}>{renderField(f, true, 240)}</div>
                          ))}
                        </div>
                      ) : (
                        <div key={group[0].id} style={{ width: "100%" }}>
                          {renderField(group[0], false, group[0].type === "number" ? 240 : undefined)}
                        </div>
                      )
                    )}
                  </div>
                );
              }

              // Fallback for any unknown card
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {renderableFields.map((f) => (
                    <div key={f.id} style={{ width: "100%" }}>
                      {renderField(f)}
                    </div>
                  ))}
                </div>
              );
            })()}
          </FormSectionCard>
        );
      })}
    </div>
  );
}
