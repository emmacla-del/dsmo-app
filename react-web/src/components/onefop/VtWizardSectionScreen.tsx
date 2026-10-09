"use client";

import { useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { FormData, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { localized, fieldDisplayLabel, isFieldVisible, computeSubsectionLayout } from "@/lib/onefop-schema";
import { VtWizardField, VtWizardInlineCountBox, VtWizardSignaturesCard } from "./VtWizardFields";
import {
  VtWizardFixedRowMultiNumberEntry,
  VtWizardProgressiveGuidedTableEntry,
  VtWizardProgressiveBooleanTableEntry,
} from "./VtWizardGuidedEntry";
import {
  isYesNoField,
  isToggleWithDependentCount,
  isVtTableField,
  vtWizardBlockSummary,
  getVtSectionShortLabel,
  VT_NO_STEPPER_IDS,
  VT_SEGMENTED_RADIO_IDS,
  type VtWizardSectionOutlineItem,
  type VtWizardSectionOutlineModel,
} from "./vt-wizard-utils";
import {
  VT_COMPACT_TOGGLE_SECTION_IDS,
  VT_TABBED_SECTION_IDS,
  VT_SIGNATURES_SECTION_ID,
  VT_ACCENT,
  VT_CARD_BORDER,
  VT_INK,
  VT_INK_SOFT,
  VT_INK_FAINT,
  VT_FAMILY,
  vtWizardTabLabel,
  vtWizardTranslateGroupTitle,
  vtWizardGetFineGroups,
  vtWizardCardFamilyOf,
  vtWizardSection1LocalisationGroups,
  vtWizardSection1EnseignementGroup,
  vtWizardRowColumnsFor,
} from "./vt-wizard-section-utils";
import type { ValidationIssue } from "@/lib/onefop-validation";
import { isVtCentreClosed, vtQuizQuestionForTable, vtTableStatus } from "@/lib/vt-quiz";
import { fieldOwnsIssue } from "@/lib/wizard-navigation";
import { VtQuizContext } from "./VtScopeQuiz";
import { FormGrid, FormCol } from "./form/FormGrid";
import { FormSection, FormSubsection } from "./form/FormSection";
import { StatusChip, type FormStatus } from "./form/StatusChip";
import { AdaptiveStatisticalTable } from "./tables/AdaptiveStatisticalTable";
import {
  buildSection41Definition,
  buildVt85TrainerStatusDefinition,
  buildVt88TrainerRosterDefinition,
} from "./tables/StatisticalTableDefinition";

/** The id of a VT section's heading, focused on every section change. */
export function vtSectionHeadingId(sectionId: string): string {
  return `vt-section-heading-${sectionId}`;
}

/**
 * Lets the shell bring a validation issue on screen before focusing it: a
 * tabbed section only mounts its active tab, so an issue in another tab has
 * no element until that tab is shown.
 */
export interface VtSectionRevealHandle {
  /** Switches to the tab that holds the issue's field, if it is not shown. */
  showIssue: (issueFieldId: string) => void;
}

interface VtWizardSectionScreenProps {
  section: OnefopSection;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issues?: ValidationIssue[];
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSaveAndExit?: () => void;
  showBottomBar?: boolean;
  saving?: boolean;
  onOutlineChange?: (outline: VtWizardSectionOutlineModel | null) => void;
  /** See VtSectionRevealHandle. */
  revealRef?: Ref<VtSectionRevealHandle>;
}

interface VtFieldGroup {
  title: string | null;
  fieldIds: string[];
  fields: OnefopField[];
}

const isVtWizardShortPairableField = (field: OnefopField): boolean =>
  ["text", "number", "email", "tel", "select"].includes(field.type) &&
  !VT_NO_STEPPER_IDS.has(field.id) ||
  (field.type === "radio" && (VT_SEGMENTED_RADIO_IDS.has(field.id) || isYesNoField(field)));

function vtWizardGroupFields(
  sectionId: string,
  fields: OnefopField[],
  subsections: OnefopSection["subsections"],
  locale: "fr" | "en",
): VtFieldGroup[] {
  const fineGroups = vtWizardGetFineGroups(sectionId);
  if (!fineGroups) {
    const groups: VtFieldGroup[] = [];
    // Sections without a FINE_GROUPS override (4, 5, 6, 8) rely entirely on
    // the schema's own subsections — this used to be stubbed to [], which
    // silently collapsed every field in those sections into one ungrouped
    // block (no card headings, no tabs, no per-block sidebar outline).
    const { headingByFieldId } = computeSubsectionLayout({
      id: sectionId, order: null, title: null, description: null, entityTypes: null, subsections, fields,
    } as unknown as OnefopSection, locale);
    let cFields: OnefopField[] = [];
    let cSub: string | null = null;
    for (const f of fields) {
      const sub = headingByFieldId.get(f.id) ?? f.visibility?.dependsOn ?? null;
      const sameGroup = cFields.length > 0 && cSub === sub;
      if (sameGroup) {
        cFields.push(f);
      } else {
        if (cFields.length > 0) groups.push({ title: cSub, fieldIds: cFields.map((x) => x.id), fields: cFields });
        cSub = sub;
        cFields = [f];
      }
    }
    if (cFields.length > 0) groups.push({ title: cSub, fieldIds: cFields.map((x) => x.id), fields: cFields });
    return groups;
  }

  const groups: VtFieldGroup[] = [];
  let cFields: OnefopField[] = [];
  let cSub: string | null = null;
  let cHasOverride = false;

  for (const f of fields) {
    const hasOverride = Object.prototype.hasOwnProperty.call(fineGroups, f.id);
    const fineSub = fineGroups[f.id];
    const sub: string | null = hasOverride
      ? (fineSub ?? null)
      : (cHasOverride ? null : (fineSub ?? cSub));

    const sameGroup =
      cFields.length > 0 &&
      cHasOverride === hasOverride &&
      ((sub == null && cSub == null) || sub === cSub || (sub && cSub && sub === cSub));

    if (sameGroup) {
      cFields.push(f);
    } else {
      if (cFields.length > 0) {
        groups.push({ title: cSub ?? null, fieldIds: cFields.map((x) => x.id), fields: cFields });
      }
      cSub = sub;
      cHasOverride = hasOverride;
      cFields = [f];
    }
  }
  if (cFields.length > 0) {
    groups.push({ title: cSub ?? null, fieldIds: cFields.map((x) => x.id), fields: cFields });
  }
  return groups;
}

function _vtWizardConditionalContainer(children: ReactNode, isRevealed: boolean): ReactNode {
  return (
    <div
      style={{
        width: "100%",
        padding: isRevealed ? 16 : 0,
        backgroundColor: "var(--cam-success-bg)",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-sm)",
        opacity: isRevealed ? 1 : 0,
        transform: isRevealed ? "translateY(0)" : "translateY(-8px)",
        transition: "all 220ms ease-out, padding 220ms ease-out, opacity 220ms ease-out",
        overflow: isRevealed ? "visible" : "hidden",
        pointerEvents: isRevealed ? "auto" : "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

const VT_COMMS_MODALITIES = [
  {
    key: "meeting",
    shortFr: "Réunion / Atelier",
    shortEn: "Meeting / Workshop",
    detailFr: "Rassemblement, assemblée générale, animation pédagogique, conseil de classes…",
    detailEn: "Meeting with children, class council, pedagogic supervision, PTA assembly…",
  },
  {
    key: "written",
    shortFr: "Par Écrit",
    shortEn: "By correspondence",
    detailFr: "Affiches, communiqué, note de service…",
    detailEn: "Notice, communique, service note…",
  },
  {
    key: "other",
    shortFr: "Autre mode",
    shortEn: "Other means",
    detailFr: "E-learning, Twitter, WhatsApp…",
    detailEn: "E-learning, twitter, WhatsApp…",
  },
] as const;

function parseSelectedChannels(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.trim() !== "") {
    if (raw === "Non/ No" || raw === "false" || raw === "2") return [];
    if (raw.includes(",")) return raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (raw === "Oui/ Yes" || raw === "true" || raw === "1") return ["meeting"];
    return [raw.trim()];
  }
  return [];
}

function VtWizardStakeholderInformedCard({
  data,
  onChange,
}: {
  field?: OnefopField;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const isEn = locale.startsWith("en");

  const stakeholders: { id: string; labelFr: string; labelEn: string }[] = [
    { id: "VT7_7", labelFr: "Élèves", labelEn: "Pupils" },
    { id: "VT7_8", labelFr: "Personnel Enseignant", labelEn: "Teaching staff" },
    { id: "VT7_9", labelFr: "Personnel Non Enseignant", labelEn: "Non-teaching staff" },
    { id: "VT7_10", labelFr: "Parents / Tuteurs", labelEn: "Parents / Guardians" },
    { id: "VT7_11", labelFr: "Conseil d'établissement", labelEn: "School council" },
  ];

  const titleText = isEn
    ? "7.1.3 If yes, kindly tick the categories below that received information on the directives by precising the communication channel"
    : "7.1.3 Si oui, Veuillez indiquer, parmi les parties prenantes de votre établissement ci-dessous, celles qui ont été informées des mesures et préciser le mode de communication utilisé pour chaque catégorie au cours de l'année scolaire";

  const subHeaderStakeholder = isEn
    ? "Groups / Categories of stakeholders"
    : "Groupes / Catégories de parties prenantes";
  const subHeaderMeans = isEn
    ? "Means of communication (Please tick the appropriate box)"
    : "Modes de communication (cocher les cases correspondantes)";

  const handleToggleChannel = (roleId: string, channelKey: string) => {
    const current = parseSelectedChannels(data[roleId]);
    const next = current.includes(channelKey)
      ? current.filter((k) => k !== channelKey)
      : [...current, channelKey];
    onChange(roleId, next);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: "#ffffff",
        border: "1px solid var(--vt-card-border, #e2e8f0)",
        borderRadius: "var(--cam-radius-md, 8px)",
        padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: VT_FAMILY,
            fontWeight: 700,
            fontSize: 13.5,
            color: VT_INK,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {titleText}
        </p>
        <p
          style={{
            fontFamily: VT_FAMILY,
            fontSize: 12,
            color: VT_INK_FAINT,
            margin: "4px 0 0 0",
            fontStyle: "italic",
          }}
        >
          {subHeaderMeans}
        </p>
      </div>

      {/* Desktop / Tablet Matrix Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12.5,
            fontFamily: VT_FAMILY,
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "var(--cam-bg-subtle)",
                borderBottom: "2px solid var(--cam-border)",
              }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontWeight: 700,
                  fontSize: 11,
                  color: VT_INK_FAINT,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  width: "38%",
                }}
              >
                {subHeaderStakeholder}
              </th>
              {VT_COMMS_MODALITIES.map((mod) => (
                <th
                  key={mod.key}
                  style={{
                    textAlign: "center",
                    padding: "8px 10px",
                    fontWeight: 700,
                    fontSize: 11,
                    color: VT_INK,
                    letterSpacing: "0.02em",
                    width: "20.6%",
                    verticalAlign: "top",
                  }}
                  title={isEn ? mod.detailEn : mod.detailFr}
                >
                  <div>{isEn ? mod.shortEn : mod.shortFr}</div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 400,
                      color: VT_INK_FAINT,
                      marginTop: 2,
                      lineHeight: 1.25,
                      textTransform: "none",
                    }}
                  >
                    {isEn ? mod.detailEn : mod.detailFr}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stakeholders.map((role, idx) => {
              const selected = parseSelectedChannels(data[role.id]);
              return (
                <tr
                  key={role.id}
                  style={{
                    borderBottom: idx < stakeholders.length - 1 ? "1px solid var(--cam-border)" : "none",
                    backgroundColor: idx % 2 === 1 ? "rgba(248, 250, 252, 0.5)" : "#ffffff",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <td style={{ padding: "12px", fontWeight: 600, color: VT_INK }}>
                    {isEn ? role.labelEn : role.labelFr}
                  </td>
                  {VT_COMMS_MODALITIES.map((mod) => {
                    const isChecked = selected.includes(mod.key);
                    const checkboxId = `${role.id}_${mod.key}`;
                    return (
                      <td
                        key={mod.key}
                        style={{
                          textAlign: "center",
                          padding: "10px",
                          verticalAlign: "middle",
                        }}
                      >
                        <label
                          htmlFor={checkboxId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: "var(--cam-radius-sm, 4px)",
                            border: `1.5px solid ${isChecked ? VT_ACCENT : "#cbd5e1"}`,
                            backgroundColor: isChecked ? VT_ACCENT : "#ffffff",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            userSelect: "none",
                          }}
                          aria-label={`${isEn ? role.labelEn : role.labelFr} — ${isEn ? mod.shortEn : mod.shortFr}`}
                        >
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleChannel(role.id, mod.key)}
                            style={{
                              position: "absolute",
                              opacity: 0,
                              width: 0,
                              height: 0,
                              margin: 0,
                              pointerEvents: "none",
                            }}
                          />
                          {isChecked && (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VtWizardFieldRows({
  fields,
  sectionId,
  data,
  onChange,
  issues,
  compact,
  columns = 2,
}: {
  fields: OnefopField[];
  sectionId: string;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issues: ValidationIssue[];
  compact: boolean;
  columns?: number;
}): ReactNode {
  const rows: ReactNode[] = [];
  const consumed = new Set<string>();
  const issueByFieldId = new Map(issues.map((i) => [i.fieldId, i.message]));

  const isVt713Section = sectionId === "section7_vocationalTraining";

  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const visibleFields = fields.filter((f) => isFieldVisible(f, data));

  for (let i = 0; i < visibleFields.length; i++) {
    const f = visibleFields[i];
    if (consumed.has(f.id)) continue;

    if (isVt713Section && f.id === "VT7_7") {
      const foldedFields = ["VT7_7", "VT7_8", "VT7_9", "VT7_10", "VT7_11"].map((id) => fieldById.get(id)).filter(Boolean) as OnefopField[];
      if (foldedFields.length > 0) {
        rows.push(
          <VtWizardStakeholderInformedCard
            key="VT7_1-11-stakeholder"
            field={foldedFields[0]}
            data={data}
            onChange={onChange}
          />,
        );
        foldedFields.forEach((fld) => consumed.add(fld.id));
        i += foldedFields.length - 1;
      }
      continue;
    }

    const next = visibleFields[i + 1];
    if (
      isToggleWithDependentCount(f, next) &&
      !(i + 2 < visibleFields.length && visibleFields[i + 2].visibility?.dependsOn === f.id)
    ) {
      rows.push(
        <VtWizardField
          key={f.id}
          field={f}
          value={data[f.id]}
          onChange={onChange}
          sectionId={sectionId}
          errorMessage={issueByFieldId.get(f.id)}
          compact={compact}
          data={data}
          inlineExtra={
            next && isFieldVisible(next, data) ? (
              <VtWizardInlineCountBox field={next} value={data[next.id]} onChange={onChange} />
            ) : null
          }
        />,
      );
      consumed.add(f.id);
      if (next) consumed.add(next.id);
      i += 1;
      continue;
    }

    const dependents = visibleFields.filter((g) => g.visibility?.dependsOn === f.id);
    if (dependents.length > 0) {
      rows.push(
        <VtWizardField
          key={f.id}
          field={f}
          value={data[f.id]}
          onChange={onChange}
          sectionId={sectionId}
          errorMessage={issueByFieldId.get(f.id)}
          compact={compact}
          data={data}
        />,
      );
      consumed.add(f.id);
      dependents.forEach((d) => consumed.add(d.id));

      const depRows = dependents
        .filter((d) => isFieldVisible(d, data))
        .map((d) => {
          const subDeps = visibleFields.filter((sub) => sub.visibility?.dependsOn === d.id);
          subDeps.forEach((sd) => consumed.add(sd.id));
          return (
            <div key={d.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <VtWizardField
                field={d}
                value={data[d.id]}
                onChange={onChange}
                sectionId={sectionId}
                errorMessage={issueByFieldId.get(d.id)}
                compact={compact}
                data={data}
              />
              {subDeps.length > 0 && (
                <div style={{ marginLeft: 16 }}>
                  {_vtWizardConditionalContainer(
                    subDeps
                      .filter((sd) => isFieldVisible(sd, data))
                      .map((sd) => (
                        <VtWizardField
                          key={sd.id}
                          field={sd}
                          value={data[sd.id]}
                          onChange={onChange}
                          sectionId={sectionId}
                          errorMessage={issueByFieldId.get(sd.id)}
                          compact={compact}
                          data={data}
                        />
                      )),
                    true,
                  )}
                </div>
              )}
            </div>
          );
        });

      const canReveal = dependents.length > 0;
      rows.push(
        <div key={`dep-${f.id}`} style={{ marginTop: 12 }}>
          {_vtWizardConditionalContainer(depRows, canReveal)}
        </div>,
      );
      i += 1;
      continue;
    }

    if (isVtTableField(f)) {
      // The wrapper carries the table field's id: a table-level validation
      // issue (fieldId = the table's id) is focused here, and a cell issue
      // falls back to it (see issueFocusCandidates).
      rows.push(
        <div key={f.id} id={f.id} tabIndex={-1} style={{ minWidth: 0 }}>
          <VtWizardTableField
            field={f}
            data={data}
            onChange={onChange}
          />
        </div>,
      );
      consumed.add(f.id);
      i += 1;
      continue;
    }

    if (isYesNoField(f) || VT_SEGMENTED_RADIO_IDS.has(f.id)) {
      // No extra wrapper margin here: VtWizardField already applies its own
      // marginBottom, and FormSubsection's flex `gap` spaces every row —
      // stacking a third margin on top of both was compounding into ~50px+
      // of dead space between consecutive Yes/No questions (very visible in
      // Section 2, which has many in a row; Section 1 has almost none).
      rows.push(
        <VtWizardField
          key={f.id}
          field={f}
          value={data[f.id]}
          onChange={onChange}
          sectionId={sectionId}
          errorMessage={issueByFieldId.get(f.id)}
          compact={compact}
          data={data}
        />,
      );
    } else if (isVtWizardShortPairableField(f)) {
      const batch: OnefopField[] = [f];
      let j = 1;
      while (batch.length < columns && i + j < visibleFields.length && isVtWizardShortPairableField(visibleFields[i + j])) {
        batch.push(visibleFields[i + j]);
        j++;
      }
      batch.forEach((bf) => consumed.add(bf.id));

      // CSS Grid handles the mobile-1-column / desktop-N-column collapse —
      // no viewport-width read needed. batch.length is always <= columns
      // (<= 3), so it's a safe cast to FormGrid's 1|2|3 column union.
      rows.push(
        <FormGrid key={f.id} columns={Math.max(1, batch.length) as 1 | 2 | 3}>
          {batch.map((bf) => (
            <FormCol key={bf.id}>
              <VtWizardField
                field={bf}
                value={data[bf.id]}
                onChange={onChange}
                sectionId={sectionId}
                errorMessage={issueByFieldId.get(bf.id)}
                compact={compact}
                data={data}
              />
            </FormCol>
          ))}
        </FormGrid>,
      );
      i += batch.length - 1;
    } else {
      rows.push(
        <VtWizardField
          key={f.id}
          field={f}
          value={data[f.id]}
          onChange={onChange}
          sectionId={sectionId}
          errorMessage={issueByFieldId.get(f.id)}
          compact={compact}
          data={data}
        />,
      );
    }
  }

  return <>{rows}</>;
}

// VT wizard tables always render as guided-entry cards now — there is no
// spreadsheet/"Mode Tableur" fallback (Flutter's VtWizardRosterGuidedEntry,
// VtWizardFixedRowMultiNumberEntry, VtWizardProgressiveGuidedTableEntry and
// VtWizardProgressiveBooleanTableEntry cover every VT table shape).
function VtWizardTableField({
  field,
  data,
  onChange,
}: {
  field: OnefopField;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
}) {
  const { openQuiz } = useContext(VtQuizContext);
  const isEn = useLocale().startsWith("en");
  const table = field.table;
  const vt = table?.vt;
  if (!table || !vt) return null;

  // Whether the table applies comes from the preliminary quiz (vt-quiz.ts).
  // A closed or non-functional centre has no quiz: its tables stay optional.
  if (!isVtCentreClosed(data)) {
    const status = vtTableStatus(field.id, data);
    const question = vtQuizQuestionForTable(field.id);
    const code = vt.paperCode ?? field.paperCode ?? field.id;
    const noteStyle = { margin: "4px 0 16px", fontSize: 13, color: "var(--cam-text-muted)", lineHeight: 1.5 } as const;
    const linkStyle = {
      marginLeft: 8, background: "none", border: "none", padding: 0, color: "var(--cam-green)",
      fontSize: 13, fontWeight: 600, textDecoration: "underline", cursor: "pointer",
    } as const;
    if (status === "NONE") {
      return (
        <p style={noteStyle}>
          {field.id === "VT4_6"
            ? isEn
              ? `Table ${code} concerns initial training only, which question 2.1.14 does not list.`
              : `Le tableau ${code} ne concerne que la formation initiale, que la question 2.1.14 ne mentionne pas.`
            : isEn
              ? `Table ${code}: nothing to report (answer "No" in the preliminary questionnaire).`
              : `Tableau ${code} : aucun cas à signaler (réponse « Non » au questionnaire préliminaire).`}
          {question && openQuiz && (
            <button type="button" onClick={openQuiz} style={linkStyle}>
              {isEn ? "Change" : "Modifier"}
            </button>
          )}
        </p>
      );
    }
    if (status === undefined) {
      return (
        <p style={noteStyle}>
          {isEn
            ? `Table ${code} depends on a question of the preliminary questionnaire, which is not answered yet.`
            : `Le tableau ${code} dépend d'une question du questionnaire préliminaire, pas encore répondue.`}
          {openQuiz && (
            <button type="button" onClick={openQuiz} style={linkStyle}>
              {isEn ? "Open the preliminary questionnaire" : "Ouvrir le questionnaire préliminaire"}
            </button>
          )}
        </p>
      );
    }
  }

  const changeCell = (cellId: string, value: unknown) => {
    onChange(cellId, value);
  };

  // Section 4.1 Pilot: Adaptive Statistical Table (direct Grid on desktop + Guided Cards)
  if (field.id === "VT4_1") {
    const definition = buildSection41Definition(field);
    return (
      <AdaptiveStatisticalTable
        definition={definition}
        data={data}
        onChange={changeCell}
      />
    );
  }

  // Section 8.5: Statistical Table (3 official rows: VP, VNP, Permanents)
  if (field.id === "VT8_5") {
    const definition = buildVt85TrainerStatusDefinition(field);
    return (
      <AdaptiveStatisticalTable
        definition={definition}
        data={data}
        onChange={changeCell}
      />
    );
  }

  if (vt.isRoster) {
    const definition = buildVt88TrainerRosterDefinition(field);
    return (
      <AdaptiveStatisticalTable
        definition={definition}
        data={data}
        onChange={changeCell}
      />
    );
  }
  if (!vt.progressiveRows) {
    return <VtWizardFixedRowMultiNumberEntry field={field} data={data} onChange={changeCell} />;
  }

  const isBoolean =
    vt.cells.length >= 2 &&
    vt.cells.slice(1).every((c) => c.kind === "boolean");

  return isBoolean
    ? <VtWizardProgressiveBooleanTableEntry field={field} data={data} onChange={changeCell} />
    : <VtWizardProgressiveGuidedTableEntry field={field} data={data} onChange={changeCell} />;
}

const SECTION1_LOCALISATION_TITLE = "Localisation administrative et Milieu d'implantation";
const SECTION1_ENSEIGNEMENT_TITLE = "Ordre d'enseignement et Type de CFP";

/// §1.1's exact fixed rows: Code/Nom/Sigle, then Région/Département/
/// Arrondissement, then Commune/Village/Milieu — three fixed 3-wide rows
/// regardless of each field's own type, matching Flutter's
/// _vtWizardIdentificationLocalisationRows (bypasses the generic batcher).
function VtWizardSection1LocalisationRows({
  group,
  data,
  onChange,
  issues,
  sectionId,
  compact,
}: {
  group: VtFieldGroup;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issues: ValidationIssue[];
  sectionId: string;
  compact: boolean;
}): ReactNode {
  const fieldById = new Map(group.fields.map((f) => [f.id, f]));
  const issueByFieldId = new Map(issues.map((i) => [i.fieldId, i.message]));
  const rowGroups = vtWizardSection1LocalisationGroups();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {rowGroups.map((rg, idx) => (
        <VtWizardFixedRow
          key={idx}
          fieldIds={rg.ids}
          fieldById={fieldById}
          data={data}
          onChange={onChange}
          sectionId={sectionId}
          issueByFieldId={issueByFieldId}
          compact={compact}
        />
      ))}
    </div>
  );
}

/// §1.2's exact rows in official order: Ordre d'enseignement (1.10), then Type de CFP (1.11).
function VtWizardSection1EnseignementRows({
  group,
  data,
  onChange,
  issues,
  sectionId,
  compact,
}: {
  group: VtFieldGroup;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issues: ValidationIssue[];
  sectionId: string;
  compact: boolean;
}): ReactNode {
  const fieldById = new Map(group.fields.map((f) => [f.id, f]));
  const issueByFieldId = new Map(issues.map((i) => [i.fieldId, i.message]));
  const { ids } = vtWizardSection1EnseignementGroup();
  const [ordreId, typeCfpId] = ids;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <VtWizardFixedRow
        fieldIds={[ordreId]}
        fieldById={fieldById}
        data={data}
        onChange={onChange}
        sectionId={sectionId}
        issueByFieldId={issueByFieldId}
        compact={compact}
      />
      <VtWizardFixedRow
        fieldIds={[typeCfpId]}
        fieldById={fieldById}
        data={data}
        onChange={onChange}
        sectionId={sectionId}
        issueByFieldId={issueByFieldId}
        compact={compact}
      />
    </div>
  );
}

function VtWizardFixedRow({
  fieldIds,
  flexes,
  fieldById,
  data,
  onChange,
  sectionId,
  issueByFieldId,
  compact,
}: {
  fieldIds: string[];
  /** Only ever [3, 2] today (VT1_10 wide beside VT1_14 narrow) — handled as
   * a fixed CSS ratio row below rather than a generic mechanism, since
   * FormGrid's columns are equal-width by design. */
  flexes?: number[];
  fieldById: Map<string, OnefopField>;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  sectionId: string;
  issueByFieldId: Map<string, string>;
  compact: boolean;
}): ReactNode {
  const fields = fieldIds.map((id) => fieldById.get(id)).filter((f): f is OnefopField => !!f);

  if (flexes && flexes.length === fields.length && fields.length === 2) {
    return (
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:flex-[3] min-w-0">
          <VtWizardField
            field={fields[0]}
            value={data[fields[0].id]}
            onChange={onChange}
            sectionId={sectionId}
            errorMessage={issueByFieldId.get(fields[0].id)}
            compact={compact}
            data={data}
          />
        </div>
        <div className="md:flex-[2] min-w-0">
          <VtWizardField
            field={fields[1]}
            value={data[fields[1].id]}
            onChange={onChange}
            sectionId={sectionId}
            errorMessage={issueByFieldId.get(fields[1].id)}
            compact={compact}
            data={data}
          />
        </div>
      </div>
    );
  }

  return (
    <FormGrid columns={Math.min(3, Math.max(1, fields.length)) as 1 | 2 | 3}>
      {fields.map((f) => (
        <FormCol key={f.id}>
          <VtWizardField
            field={f}
            value={data[f.id]}
            onChange={onChange}
            sectionId={sectionId}
            errorMessage={issueByFieldId.get(f.id)}
            compact={compact}
            data={data}
          />
        </FormCol>
      ))}
    </FormGrid>
  );
}

function VtWizardCardForGroup({
  group,
  sectionId,
  data,
  onChange,
  issues,
  compact,
  headingTextOverride,
  headingTrailing,
  columns = 2,
}: {
  group: VtFieldGroup;
  sectionId: string;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issues: ValidationIssue[];
  compact: boolean;
  headingTextOverride?: string;
  headingTrailing?: ReactNode;
  columns?: number;
}): ReactNode {
  const locale = useLocale();
  // headingText is a stable French identity/grouping key (compared below and
  // used for family lookups elsewhere) — never render it directly. Only the
  // translated displayHeadingText is shown to the user. `variant` is an
  // explicit structural choice (not a title.includes() check) fed to
  // FormSubsection: these specific groups render as a plain dark-green
  // label, every other group gets the accent-bar treatment.
  const headingText = headingTextOverride ?? group.title ?? null;
  const displayHeadingText = vtWizardTranslateGroupTitle(headingText, locale);
  const plainHeading =
    headingText === "Localisation administrative et Milieu d'implantation" ||
    headingText === "Ordre d'enseignement et Type de CFP" ||
    headingText === "Situation d'activité et Contacts" ||
    headingText === "Conventions, Sites et Infrastructures" ||
    headingText === "Accessibilité & Adressage postal" ||
    headingText === "Agrément de fonctionnement (Accreditation)" ||
    headingText === "Régime et Volume Global d'Apprenants";

  const content =
    headingText === SECTION1_LOCALISATION_TITLE ? (
      <VtWizardSection1LocalisationRows
        group={group}
        data={data}
        onChange={onChange}
        issues={issues}
        sectionId={sectionId}
        compact={compact}
      />
    ) : headingText === SECTION1_ENSEIGNEMENT_TITLE ? (
      <VtWizardSection1EnseignementRows
        group={group}
        data={data}
        onChange={onChange}
        issues={issues}
        sectionId={sectionId}
        compact={compact}
      />
    ) : (
      <VtWizardFieldRows
        fields={group.fields}
        sectionId={sectionId}
        data={data}
        onChange={onChange}
        issues={issues}
        compact={compact}
        columns={columns}
      />
    );

  return (
    <FormSubsection title={headingText ? displayHeadingText : undefined} variant={plainHeading ? "plain" : "accent"} trailing={headingTrailing}>
      {content}
    </FormSubsection>
  );
}

function VtWizardBlockStatusChip({
  summary,
  t,
}: {
  summary?: VtWizardSectionOutlineItem;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, values?: any) => string;
}): ReactNode {
  if (!summary) return null;
  const { errors, status, filled, total } = summary;

  // summary.status already encodes the same priority the old inline chip
  // used (errors win, then complete, then partial) — see
  // vtWizardBlockSummary in vt-wizard-utils.ts.
  const formStatus: FormStatus =
    status === "needsAttention" ? "has-errors" :
    status === "complete" ? "complete" :
    status === "inProgress" ? "in-progress" : "not-started";

  const label =
    formStatus === "has-errors" ? t("vtWizard.blockChipNeedsAttention", { count: errors }) :
    formStatus === "complete" ? t("vtWizard.blockChipComplete", { filled, total }) :
    formStatus === "in-progress" ? t("vtWizard.blockChipPartial", { filled, total }) :
    "";

  return <StatusChip status={formStatus} label={label} />;
}

function VtWizardCategoryTabs({
  groups,
  activeIndex,
  onChange,
  sectionId,
}: {
  groups: VtFieldGroup[];
  activeIndex: number;
  onChange: (index: number) => void;
  sectionId: string;
}): ReactNode {
  const locale = useLocale();
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        borderBottom: "1.5px solid var(--cam-border)",
        marginBottom: 20,
      }}
    >
      {groups.map((g, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: isActive
                ? "2px solid var(--cam-green)"
                : "2px solid transparent",
              marginBottom: -1.5,
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--cam-font-sans)",
              fontWeight: isActive ? 700 : 500,
              fontSize: 13,
              color: isActive ? "var(--cam-green)" : "var(--cam-text-muted)",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {vtWizardTabLabel(sectionId, i, locale) ?? g.fields[0]?.paperCode ?? String(i + 1)}
          </button>
        );
      })}
    </div>
  );
}

export function VtWizardSectionScreen({
  section,
  data,
  onChange,
  issues = [],
  isFirst,
  isLast,
  onBack,
  onNext,
  onSaveAndExit,
  showBottomBar = true,
  saving = false,
  onOutlineChange,
  revealRef,
}: VtWizardSectionScreenProps) {
  const t = useTranslations();
  const locale = useLocale();
  const sectionId = section.id;
  const compact = VT_COMPACT_TOGGLE_SECTION_IDS.has(sectionId);

  const visibleFields = section.fields.filter((f) => isFieldVisible(f, data));
  const visibleFieldsReordered = visibleFields;

  const normalizedLocale = locale.startsWith("en") ? "en" : "fr";
  const groups = useMemo(
    () => vtWizardGroupFields(sectionId, visibleFieldsReordered, section.subsections, normalizedLocale),
    [sectionId, visibleFieldsReordered, section.subsections, normalizedLocale],
  );

  const rowColumns = vtWizardRowColumnsFor(sectionId);

  const tabbed = VT_TABBED_SECTION_IDS.has(sectionId);

  const [activeTab, setActiveTab] = useState(0);

  useImperativeHandle(
    revealRef,
    () => ({
      showIssue: (issueFieldId: string) => {
        if (!tabbed || groups.length < 2) return;
        const idx = groups.findIndex((g) => g.fields.some((f) => fieldOwnsIssue(f, issueFieldId)));
        if (idx !== -1) setActiveTab(idx);
      },
    }),
    [tabbed, groups],
  );

  const cardFamily = (group: VtFieldGroup): string | null => {
    const sub = group.title;
    if (!sub) return null;
    return vtWizardCardFamilyOf(sub);
  };

  const cardChunks: number[][] = [];
  let openFamily: string | null = null;
  for (let i = 0; i < groups.length; i++) {
    const family = cardFamily(groups[i]);
    if (family != null && family === openFamily) {
      cardChunks[cardChunks.length - 1].push(i);
    } else {
      cardChunks.push([i]);
      openFamily = family;
    }
  }

  const groupLabels = groups.map(
    (g, i) => g.title ?? t("vtWizard.blockFallbackLabel", { index: i + 1 }),
  );

  // "Section outline" — one status row per block (not-started/in-progress/
  // complete/needs-attention), shown in the sidebar under the active
  // section, matching Flutter's VtWizardSectionOutlineModel. Only
  // meaningful when there's more than one block to navigate between and
  // the section isn't tabbed (tabs already scope to one block at a time).
  const [outlinedBlock, setOutlinedBlock] = useState(0);
  const clampedOutlinedBlock = groups.length === 0 ? 0 : Math.min(outlinedBlock, groups.length - 1);

  const scrollToBlock = (index: number) => {
    setOutlinedBlock(index);
    const el = document.getElementById(`vt-outline-block-${sectionId}-${index}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const issueFieldIds = useMemo(() => new Set(issues.map((i) => i.fieldId)), [issues]);
  const blockSummaries = useMemo(
    () =>
      groups.map((g, i) =>
        vtWizardBlockSummary(g.fields, vtWizardTranslateGroupTitle(groupLabels[i], locale), data, issueFieldIds),
      ),
    [groups, groupLabels, locale, data, issueFieldIds],
  );

  const sectionOutline: VtWizardSectionOutlineModel | null =
    !tabbed && blockSummaries.length > 1
      ? { items: blockSummaries, activeIndex: clampedOutlinedBlock, onSelect: scrollToBlock }
      : null;

  const onOutlineChangeRef = useRef(onOutlineChange);
  onOutlineChangeRef.current = onOutlineChange;
  const outlineSignature = sectionOutline
    ? `${sectionOutline.activeIndex}:${sectionOutline.items
        .map((it) => `${it.label}/${it.filled}/${it.total}/${it.errors}/${it.status}`)
        .join("|")}`
    : "none";
  useEffect(() => {
    onOutlineChangeRef.current?.(sectionOutline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineSignature]);

  const shortLabel = getVtSectionShortLabel(sectionId, locale);
  const sectionTitle = shortLabel ?? (section.title ? localized(section.title, locale.startsWith("en") ? "en" : "fr") : sectionId);

  const isSignaturesSection = sectionId === VT_SIGNATURES_SECTION_ID;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          borderLeft: "4px solid #0e4d29",
          paddingLeft: 14,
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: 12,
        }}
      >
        {/* Focus target of the shell on every section change (useStepFocus):
            not a Tab stop, and no ring around a title. */}
        <h2
          id={vtSectionHeadingId(sectionId)}
          tabIndex={-1}
          style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em", color: "#0f172a", margin: 0, textTransform: "uppercase", outline: "none" }}
        >
          {sectionTitle}
        </h2>
      </div>

      <div style={{ width: "100%" }}>
        {groups.length === 0 ? (
          <p style={{ fontFamily: "var(--cam-font-sans)", fontSize: 15, color: "var(--cam-text-muted)", padding: "8px 0" }}>
            {t("vtWizard.noFieldsVisible", { default: "Aucun champ visible pour le moment." })}
          </p>
        ) : tabbed && groups.length > 1 ? (
          <div>
            <VtWizardCategoryTabs
              groups={groups}
              activeIndex={activeTab}
              onChange={setActiveTab}
              sectionId={sectionId}
            />
            {groups[activeTab] && (
              <FormSection>
                <VtWizardCardForGroup
                  group={groups[activeTab]}
                  sectionId={sectionId}
                  data={data}
                  onChange={onChange}
                  issues={issues}
                  compact={compact}
                  columns={rowColumns}
                  headingTextOverride={groups[activeTab].title ?? undefined}
                />

                {isSignaturesSection && (
                  <div style={{ marginTop: 24 }}>
                    <VtWizardSignaturesCard />
                  </div>
                )}
              </FormSection>
            )}
          </div>
        ) : groups.length > 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {cardChunks.map((chunk, c) => (
              <FormSection key={c}>
                {chunk.map((groupIndex, j) => {
                  const group = groups[groupIndex];
                  return (
                    <div key={groupIndex} id={`vt-outline-block-${sectionId}-${groupIndex}`}>
                      {j !== 0 && (
                        <div style={{ height: 1, backgroundColor: VT_CARD_BORDER, margin: "20px 0" }} />
                      )}
                      <VtWizardCardForGroup
                        group={group}
                        sectionId={sectionId}
                        data={data}
                        onChange={onChange}
                        issues={issues}
                        compact={compact}
                        columns={rowColumns}
                        headingTextOverride={groupLabels[groupIndex]}
                        headingTrailing={<VtWizardBlockStatusChip summary={blockSummaries[groupIndex]} t={t} />}
                      />
                    </div>
                  );
                })}

                {isSignaturesSection && c === cardChunks.length - 1 && (
                  <div style={{ marginTop: 20 }}>
                    <VtWizardSignaturesCard />
                  </div>
                )}
              </FormSection>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {groups.map((group, i) => (
              <FormSection key={i}>
                <VtWizardCardForGroup
                  group={group}
                  sectionId={sectionId}
                  data={data}
                  onChange={onChange}
                  issues={issues}
                  compact={compact}
                  columns={rowColumns}
                  headingTextOverride={group.fields.length > 0 ? groupLabels[i] : undefined}
                  headingTrailing={
                    group.fields.length > 0 ? <VtWizardBlockStatusChip summary={blockSummaries[i]} t={t} /> : undefined
                  }
                />

                {isSignaturesSection && (
                  <div style={{ marginTop: 20 }}>
                    <VtWizardSignaturesCard />
                  </div>
                )}
              </FormSection>
            ))}
          </div>
        )}
      </div>

      {showBottomBar && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: "12px 0",
            // Sticks to the bottom of the nearest scrolling ancestor (the
            // section content pane in WizardShell.tsx) so it stays reachable
            // without scrolling, matching Flutter's Positioned(bottom: 0)
            // bar and React's own non-VT bottom bar.
            position: "sticky",
            bottom: 0,
            zIndex: 10,
            backgroundColor: "#ffffff",
            borderTop: `1px solid ${VT_CARD_BORDER}`,
            boxShadow: "0 -3px 10px rgba(0,0,0,.06)",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              border: `1px solid ${VT_CARD_BORDER}`,
              background: "#ffffff",
              color: VT_INK_SOFT,
              cursor: "pointer",
            }}
          >
            ←{" "}
            {isFirst && onSaveAndExit
              ? t("vtWizard.cancel", { default: "Annuler" })
              : t("vtWizard.previous", { default: "Étape précédente" })}
          </button>
          <div style={{ flex: 1 }} />
          {onSaveAndExit && (
            <button
              type="button"
              onClick={onSaveAndExit}
              disabled={saving}
              style={{
                height: 40,
                padding: "0 20px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${VT_CARD_BORDER}`,
                background: "#ffffff",
                color: VT_INK_SOFT,
                cursor: "pointer",
              }}
            >
              💾 {t("vtWizard.saveAndExit", { default: "Enregistrer et quitter" })}
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            style={{
              height: 40,
              padding: "0 24px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              background: VT_ACCENT,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            {isLast
              ? t("vtWizard.proceedToValidation", { default: "Passer à la Validation" })
              : t("vtWizard.nextStep", { default: "Suivant" })}
            {" →"}
          </button>
        </div>
      )}
    </div>
  );
}
