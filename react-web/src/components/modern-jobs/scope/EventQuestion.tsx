"use client";

import { useTranslations } from "next-intl";
import React from "react";
import type { ScopeState, BeatDefinition, PrimaryQuestionId, ChildBeatId } from "./ScopeTypes";
import {
  CSP_OPTIONS,
  AGE_BAND_OPTIONS,
  DIPLOMA_OPTIONS,
  DEPARTURE_REASON_OPTIONS,
  INTERNSHIP_TYPE_OPTIONS,
  RECRUITMENT_TYPE_OPTIONS,
} from "./ScopeTypes";
import { ConditionalOptions } from "./ConditionalOptions";

interface EventQuestionProps {
  beat: BeatDefinition;
  beatIndex: number;
  totalBeats: number;
  isFirstBeat: boolean;
  isLastBeat: boolean;
  scope: ScopeState;
  onUpdateScope: (partial: Partial<ScopeState>) => void;
  onPrev: () => void;
  onContinue: () => void;
  onSelectMainYes: (mainId: PrimaryQuestionId) => void;
  onSelectMainNo: (mainId: PrimaryQuestionId) => void;
  hasTable: (code: string) => boolean;
  isEnterprise: boolean;
  locale?: "fr" | "en";
  headerSlot?: React.ReactNode;
}

export function EventQuestion({
  beat,
  beatIndex,
  totalBeats,
  isFirstBeat,
  isLastBeat,
  scope,
  onUpdateScope,
  onPrev,
  onContinue,
  onSelectMainYes,
  onSelectMainNo,
  hasTable,
  isEnterprise,
  locale = "fr",
  headerSlot,
}: EventQuestionProps) {
  const isEn = locale === "en";
  const t = useTranslations("modernJobs.event");
  const { mainId, childBeatId } = beat;

  // Validation check for the active beat
  const canContinue = (() => {
    if (!childBeatId) {
      // Main beat: can continue if already answered
      switch (mainId) {
        case "applications":
          return scope.applications !== null;
        case "recruitment":
          return scope.recruit !== null;
        case "primo_seekers":
          return scope.primo_seekers !== null;
        case "primo_workers":
          return scope.primo_workers !== null;
        case "departures":
          return scope.departures !== null;
        case "interns":
          return scope.interns !== null;
        case "skills":
          return scope.skills_needs !== null;
        case "training":
          return scope.training_needs !== null;
        default:
          return false;
      }
    }

    // Child beat
    switch (childBeatId) {
      case "application_csp":
        return scope.application_csp.length > 0;
      case "application_age":
        return scope.application_age.length > 0;
      case "recruit_types":
        return scope.recruit_types.length > 0;
      case "recruit_csp":
        return scope.recruit_csp.length > 0;
      case "recruit_age":
        return scope.recruit_age.length > 0;
      case "recruit_diploma":
        return scope.recruit_diploma.length > 0;
      case "recruit_disability":
        return scope.disability !== null;
      case "recruit_vulnerable":
        return scope.vulnerable !== null;
      case "primo_seekers_csp":
        return scope.primo_seekers_csp.length > 0;
      case "primo_seekers_age":
        return scope.primo_seekers_age.length > 0;
      case "primo_workers_types":
        return scope.primo_workers_types.length > 0;
      case "primo_workers_csp":
        return scope.primo_workers_csp.length > 0;
      case "primo_workers_age":
        return scope.primo_workers_age.length > 0;
      case "departure_reasons":
        return scope.departure_reasons.length > 0;
      case "dismissal_technical":
        return scope.dismissal_technical !== null;
      case "intern_types":
        return scope.intern_types.length > 0;
      default:
        return true;
    }
  })();

  const renderYesNo = (
    value: boolean | null,
    onSelect: (val: boolean) => void,
    ariaLabel: string
  ) => {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        style={{ display: "flex", gap: 12, marginTop: 14, marginBottom: 8, maxWidth: 360 }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === true}
          onClick={() => onSelect(true)}
          style={{
            flex: 1,
            padding: "11px 18px",
            borderRadius: "var(--cam-radius-control, 6px)",
            border: value === true ? "2px solid var(--cam-green)" : "1px solid var(--cam-border)",
            background:
              value === true
                ? "var(--cam-success-bg)"
                : "var(--cam-surface)",
            color:
              value === true
                ? "var(--cam-green)"
                : "var(--cam-text)",
            fontWeight: 700,
            fontSize: "var(--cam-answer-size)",
            cursor: "pointer",
            transition: "all 0.12s ease",
            textAlign: "center",
          }}
        >
          {t("yes")}
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={value === false}
          onClick={() => onSelect(false)}
          style={{
            flex: 1,
            padding: "11px 18px",
            borderRadius: "var(--cam-radius-control, 6px)",
            border: value === false ? "2px solid var(--cam-green)" : "1px solid var(--cam-border)",
            background:
              value === false
                ? "var(--cam-success-bg)"
                : "var(--cam-surface)",
            color:
              value === false
                ? "var(--cam-green)"
                : "var(--cam-text)",
            fontWeight: 700,
            fontSize: "var(--cam-answer-size)",
            cursor: "pointer",
            transition: "all 0.12s ease",
            textAlign: "center",
          }}
        >
          {t("no")}
        </button>
      </div>
    );
  };

  const getMainQuestionTitle = (qId: PrimaryQuestionId): string => {
    switch (qId) {
      case "applications":
        return t("q.applications");
      case "recruitment":
        return t("q.recruitment");
      case "primo_seekers":
        return t("q.primoSeekers");
      case "primo_workers":
        return t("q.primoWorkers");
      case "departures":
        return t("q.departures");
      case "interns":
        return t("q.interns");
      case "skills":
        return t("q.skills");
      case "training":
        return t("q.training");
      default:
        return "";
    }
  };

  const getParentEventContext = (qId: PrimaryQuestionId): string => {
    switch (qId) {
      case "applications":
        return t("short.applications");
      case "recruitment":
        return t("short.recruitment");
      case "primo_seekers":
        return t("short.primoSeekers");
      case "primo_workers":
        return t("short.primoWorkers");
      case "departures":
        return t("short.departures");
      case "interns":
        return t("short.interns");
      default:
        return "";
    }
  };

  return (
    <section
      aria-labelledby="active-event-question-title"
      className="cam-quiz-card"
      style={{
        boxSizing: "border-box",
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-md, 8px)",
        padding: "clamp(16px, 2.5vw, 24px)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Navigation tabs inside the quiz box (Pinned Header) */}
      {headerSlot && <div style={{ flexShrink: 0 }}>{headerSlot}</div>}

      {/* Scrollable Question Body Area */}
      <div
        className="cam-quiz-body-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          paddingRight: 4,
          paddingBottom: 8,
        }}
      >
        {/* Intro for the very first beat only */}
        {isFirstBeat && (
          <div
            style={{
              padding: "11px 16px",
              background: "var(--cam-bg)",
              borderLeft: "3px solid var(--cam-green)",
              borderRadius: "0 4px 4px 0",
              fontSize: "var(--cam-font-size-sm)",
              color: "var(--cam-text-muted)",
              lineHeight: "var(--cam-line-height-copy)",
              marginBottom: 14,
            }}
          >
            {t("intro")}
          </div>
        )}

        {/* RENDER ACTIVE BEAT */}
      {!childBeatId ? (
        /* MAIN BEAT */
        <div>
          <h2
            id="active-event-question-title"
            className="cam-question"
            style={{ margin: "0 0 var(--cam-space-2)" }}
          >
            {getMainQuestionTitle(mainId)}
          </h2>

          {/* Side-by-side Yes/No controls */}
          {mainId === "applications" &&
            renderYesNo(
              scope.applications,
              (val) => (val ? onSelectMainYes("applications") : onSelectMainNo("applications")),
              t("aria.applications")
            )}

          {mainId === "recruitment" &&
            renderYesNo(
              scope.recruit,
              (val) => (val ? onSelectMainYes("recruitment") : onSelectMainNo("recruitment")),
              t("aria.recruitment")
            )}

          {mainId === "primo_seekers" &&
            renderYesNo(
              scope.primo_seekers,
              (val) => (val ? onSelectMainYes("primo_seekers") : onSelectMainNo("primo_seekers")),
              t("aria.primoSeekers")
            )}

          {mainId === "primo_workers" &&
            renderYesNo(
              scope.primo_workers,
              (val) => (val ? onSelectMainYes("primo_workers") : onSelectMainNo("primo_workers")),
              t("aria.primoWorkers")
            )}

          {mainId === "departures" &&
            renderYesNo(
              scope.departures,
              (val) => (val ? onSelectMainYes("departures") : onSelectMainNo("departures")),
              t("aria.departures")
            )}

          {mainId === "interns" &&
            renderYesNo(
              scope.interns,
              (val) => (val ? onSelectMainYes("interns") : onSelectMainNo("interns")),
              t("aria.interns")
            )}

          {mainId === "skills" &&
            renderYesNo(
              scope.skills_needs,
              (val) => (val ? onSelectMainYes("skills") : onSelectMainNo("skills")),
              t("aria.skills")
            )}

          {mainId === "training" &&
            renderYesNo(
              scope.training_needs,
              (val) => (val ? onSelectMainYes("training") : onSelectMainNo("training")),
              t("aria.training")
            )}
        </div>
      ) : (
        /* CHILD BEAT */
        <div>
          {/* Parent event context header */}
          <div className="cam-hint" style={{ marginBottom: "var(--cam-space-1)" }}>
            {getParentEventContext(mainId)}
          </div>

          {/* Applications Child 1: CSP */}
          {childBeatId === "application_csp" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("staffCategories")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("applicationsCspQ")}
              </p>
              <ConditionalOptions
                options={CSP_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.application_csp}
                onChange={(selected) => onUpdateScope({ application_csp: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.staffCategories")}
              />
            </div>
          )}

          {/* Applications Child 2: Ages */}
          {childBeatId === "application_age" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("ageGroups")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("applicationsAgeQ")}
              </p>
              <ConditionalOptions
                options={AGE_BAND_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.application_age}
                onChange={(selected) => onUpdateScope({ application_age: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.ageGroups")}
              />
            </div>
          )}

          {/* Recruitment Child 1: Types de recrutement */}
          {childBeatId === "recruit_types" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("recruitmentTypes")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("recruitTypesQ")}
              </p>
              <ConditionalOptions
                options={RECRUITMENT_TYPE_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.recruit_types}
                onChange={(selected) => onUpdateScope({ recruit_types: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.recruitmentTypes")}
              />
            </div>
          )}

          {/* Recruitment Child 2: Personnels concernés */}
          {childBeatId === "recruit_csp" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("staffCategories")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("recruitCspQ")}
              </p>
              <ConditionalOptions
                options={CSP_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.recruit_csp}
                onChange={(selected) => onUpdateScope({ recruit_csp: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.staffCategories")}
              />
            </div>
          )}

          {/* Recruitment Child 3: Groupes d'âge */}
          {childBeatId === "recruit_age" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("ageGroups")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("recruitAgeQ")}
              </p>
              <ConditionalOptions
                options={AGE_BAND_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.recruit_age}
                onChange={(selected) => onUpdateScope({ recruit_age: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.ageGroups")}
              />
            </div>
          )}

          {/* Recruitment Child 4: Niveaux de diplôme */}
          {childBeatId === "recruit_diploma" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("diplomaLevels")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("recruitDiplomaQ")}
              </p>
              <ConditionalOptions
                options={DIPLOMA_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.recruit_diploma}
                onChange={(selected) => onUpdateScope({ recruit_diploma: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.diplomaLevels")}
              />
            </div>
          )}

          {/* Recruitment Child 5: Personnes en situation de handicap ? */}
          {childBeatId === "recruit_disability" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("disabilityTitle")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("disabilityQ")}
              </p>
              {renderYesNo(
                scope.disability,
                (val) => onUpdateScope({ disability: val }),
                t("aria.disability")
              )}
            </div>
          )}

          {/* Recruitment Child 6: Personnes vulnérables ? */}
          {childBeatId === "recruit_vulnerable" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("vulnerableTitle")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("vulnerableQ")}
              </p>
              {renderYesNo(
                scope.vulnerable,
                (val) => onUpdateScope({ vulnerable: val }),
                t("aria.vulnerable")
              )}
            </div>
          )}

          {/* Primo Seekers Child 1: CSP */}
          {childBeatId === "primo_seekers_csp" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("staffCategories")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("primoSeekersCspQ")}
              </p>
              <ConditionalOptions
                options={CSP_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.primo_seekers_csp}
                onChange={(selected) => onUpdateScope({ primo_seekers_csp: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.staffCategories")}
              />
            </div>
          )}

          {/* Primo Seekers Child 2: Ages */}
          {childBeatId === "primo_seekers_age" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("ageGroups")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("primoSeekersAgeQ")}
              </p>
              <ConditionalOptions
                options={AGE_BAND_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.primo_seekers_age}
                onChange={(selected) => onUpdateScope({ primo_seekers_age: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.ageGroups")}
              />
            </div>
          )}

          {/* Primo Workers Child 1: Types de recrutement */}
          {childBeatId === "primo_workers_types" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("recruitmentTypes")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("primoWorkersTypesQ")}
              </p>
              <ConditionalOptions
                options={RECRUITMENT_TYPE_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.primo_workers_types}
                onChange={(selected) => onUpdateScope({ primo_workers_types: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.recruitmentTypes")}
              />
            </div>
          )}

          {/* Primo Workers Child 2: CSP */}
          {childBeatId === "primo_workers_csp" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("staffCategories")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("primoWorkersCspQ")}
              </p>
              <ConditionalOptions
                options={CSP_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.primo_workers_csp}
                onChange={(selected) => onUpdateScope({ primo_workers_csp: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.staffCategories")}
              />
            </div>
          )}

          {/* Primo Workers Child 3: Ages */}
          {childBeatId === "primo_workers_age" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("ageGroups")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("primoWorkersAgeQ")}
              </p>
              <ConditionalOptions
                options={AGE_BAND_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.primo_workers_age}
                onChange={(selected) => onUpdateScope({ primo_workers_age: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.ageGroups")}
              />
            </div>
          )}

          {/* Departures Child 1: Motifs de départ */}
          {childBeatId === "departure_reasons" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("departureReasons")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("departureReasonsQ")}
              </p>
              <ConditionalOptions
                options={DEPARTURE_REASON_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.departure_reasons}
                onChange={(selected) => {
                  const willHaveLicenciement = selected.includes("licenciement");
                  onUpdateScope({
                    departure_reasons: selected,
                    dismissal_technical: willHaveLicenciement ? scope.dismissal_technical : null,
                  });
                }}
                allowMultiple={true}
                ariaLabel={t("aria.departureReasons")}
              />
            </div>
          )}

          {/* Departures Child 2: Chômage technique ou licenciement économique ? */}
          {childBeatId === "dismissal_technical" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("technicalTitle")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("technicalQ")}
              </p>
              {renderYesNo(
                scope.dismissal_technical,
                (val) => onUpdateScope({ dismissal_technical: val }),
                t("aria.technical")
              )}
            </div>
          )}

          {/* Interns Child 1: Types de stages */}
          {childBeatId === "intern_types" && (
            <div>
              <h2
                id="active-event-question-title"
                style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", lineHeight: "var(--cam-line-height-title)", color: "var(--cam-text)", margin: "0 0 var(--cam-space-2)" }}
              >
                {t("internTypes")}
              </h2>
              <p className="cam-question" style={{ margin: "0 0 var(--cam-space-4)" }}>
                {t("internTypesQ")}
              </p>
              <ConditionalOptions
                options={INTERNSHIP_TYPE_OPTIONS.map((o) => ({ id: o.id, label: isEn ? o.en : o.fr }))}
                selected={scope.intern_types}
                onChange={(selected) => onUpdateScope({ intern_types: selected })}
                allowMultiple={true}
                ariaLabel={t("aria.internTypes")}
              />
            </div>
          )}
        </div>
      )}
      </div>

      {/* Navigation Actions inside the Quiz Box (Pinned Footer) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid var(--cam-border)",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onPrev}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cam-text-muted)",
            fontSize: "var(--cam-font-size-sm, 14px)",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: "var(--cam-radius-control, 6px)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--cam-text)";
            e.currentTarget.style.background = "var(--cam-surface-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--cam-text-muted)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span aria-hidden="true">←</span>
          <span>{t("previous")}</span>
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          style={{
            background: canContinue ? "var(--cam-green)" : "var(--cam-border)",
            color: canContinue ? "#ffffff" : "var(--cam-text-muted)",
            border: "none",
            borderRadius: "var(--cam-radius-control, 6px)",
            height: "var(--cam-button-height, 42px)",
            padding: "0 22px",
            fontSize: "var(--cam-font-size-sm, 14px)",
            fontWeight: 600,
            cursor: canContinue ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: canContinue ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>
            {isLastBeat
              ? t("openTables")
              : t("continue")}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
