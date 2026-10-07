"use client";

import { useTranslations } from "next-intl";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { FormData, OnefopEntity, OnefopField } from "@/lib/onefop-schema";
import { canonicalGatewayId, resolveTableStatusFieldId } from "../conditional/gateway-catalog";
import type {
  ScopeState,
  BeatDefinition,
  PrimaryQuestionId,
  ChildBeatId,
  FilterOption,
  TrackerChipItem,
  TrackerRow,
} from "./ScopeTypes";
import {
  DEFAULT_SCOPE,
  AGE_BAND_OPTIONS,
  CSP_OPTIONS,
  DEPARTURE_REASON_OPTIONS,
  DIPLOMA_OPTIONS,
  INTERNSHIP_TYPE_OPTIONS,
  RECRUITMENT_TYPE_OPTIONS,
} from "./ScopeTypes";
import {
  EVENT_TABLE_MAPPING,
  TABLE_PREFIX_MAP,
  findKeysMatchingPrefixes,
  hasEnteredData,
  hasEnteredDataForEvent,
  isTableReported,
} from "./ScopeDataManagement";
import {
  deriveQuizTableStatus,
  hasDisabilityTable,
  hasVulnerableTable,
  isAdministrationLayout,
  isQuizQuestionComplete,
  quizQuestionsFor,
} from "./QuizSemantics";
import { FactsReview } from "./FactsReview";
import { EventProgress, ProgressGroup } from "./EventProgress";
import { EventQuestion } from "./EventQuestion";

export interface EventFactInterviewProps {
  entity: OnefopEntity;
  data: FormData;
  onChange: (fieldId: string, value?: unknown) => void;
  onComplete: () => void;
  onBack: () => void;
  locale?: "fr" | "en";
  establishmentName?: string;
  navigationRef?: React.MutableRefObject<{
    onPrev: () => boolean;
    onNext: () => boolean;
  } | null>;
}

export function EventFactInterview({
  entity,
  data,
  onChange,
  onComplete,
  onBack,
  locale = "fr",
  establishmentName,
  navigationRef,
}: EventFactInterviewProps) {
  const t = useTranslations("modernJobs.scope");
  const tFacts = useTranslations("modernJobs.facts");

  // Catalog entity tables in Sections 2, 3, 4
  const entityTables = useMemo(() => {
    const map = new Map<string, OnefopField>();
    for (const sec of entity.sections) {
      if (sec.id === "section0" || sec.id.startsWith("section1_")) continue;
      for (const f of sec.fields) {
        if (f.type === "table" || f.type === "repeating_table" || f.table) {
          const code = (f.paperCode || canonicalGatewayId(f.id)).toUpperCase();
          map.set(code, f);
          map.set(f.id.toUpperCase(), f);
        }
      }
    }
    return map;
  }, [entity]);

  const hasTable = useCallback((code: string) => entityTables.has(code.toUpperCase()), [entityTables]);
  const getTable = useCallback((code: string) => entityTables.get(code.toUpperCase()), [entityTables]);

  const isEnterprise = entity.entityType === "enterprise";

  // Determine available primary questions for this entity
  const availableQuestionIds: PrimaryQuestionId[] = useMemo(() => quizQuestionsFor(hasTable), [hasTable]);

  // Restore saved scope if present
  const initialScope = useMemo(() => {
    if (data._scopeConfig && typeof data._scopeConfig === "object") {
      return { ...DEFAULT_SCOPE, ...(data._scopeConfig as Partial<ScopeState>) };
    }
    return { ...DEFAULT_SCOPE };
  }, [data._scopeConfig]);

  const [scope, setScope] = useState<ScopeState>(initialScope);

  // Smoothly scroll only if user has scrolled past the top of the questionnaire
  const gentleScrollToTop = useCallback(() => {
    if (typeof window !== "undefined" && window.scrollY > 160) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const isQuestionComplete = useCallback(
    (qId: PrimaryQuestionId, s: ScopeState): boolean => isQuizQuestionComplete(qId, s, hasTable),
    [hasTable],
  );

  // Compute active ordered beats based on current scope
  const orderedBeats = useMemo<BeatDefinition[]>(() => {
    const beats: BeatDefinition[] = [];

    for (const qId of availableQuestionIds) {
      // 1. Main beat
      beats.push({ mainId: qId });

      // 2. Child beats if answered "Oui"
      if (qId === "applications" && scope.applications === true) {
        beats.push({ mainId: "applications", childBeatId: "application_csp" });
        beats.push({ mainId: "applications", childBeatId: "application_age" });
      } else if (qId === "recruitment" && scope.recruit === true) {
        if (hasTable("S22Q02")) {
          beats.push({ mainId: "recruitment", childBeatId: "recruit_types" });
        }
        if (!isAdministrationLayout(hasTable)) {
          beats.push({ mainId: "recruitment", childBeatId: "recruit_csp" });
        }
        beats.push({ mainId: "recruitment", childBeatId: "recruit_age" });
        if (hasTable("S22Q03")) {
          beats.push({ mainId: "recruitment", childBeatId: "recruit_diploma" });
        }
        if (hasDisabilityTable(hasTable)) {
          beats.push({ mainId: "recruitment", childBeatId: "recruit_disability" });
        }
        if (hasVulnerableTable(hasTable)) {
          beats.push({ mainId: "recruitment", childBeatId: "recruit_vulnerable" });
        }
      } else if (qId === "primo_seekers" && scope.primo_seekers === true) {
        beats.push({ mainId: "primo_seekers", childBeatId: "primo_seekers_csp" });
        beats.push({ mainId: "primo_seekers", childBeatId: "primo_seekers_age" });
      } else if (qId === "primo_workers" && scope.primo_workers === true) {
        beats.push({ mainId: "primo_workers", childBeatId: "primo_workers_types" });
        beats.push({ mainId: "primo_workers", childBeatId: "primo_workers_csp" });
        beats.push({ mainId: "primo_workers", childBeatId: "primo_workers_age" });
      } else if (qId === "departures" && scope.departures === true) {
        beats.push({ mainId: "departures", childBeatId: "departure_reasons" });
        // Technical dismissal only if licenciement is selected and entity has S3Q03
        if (hasTable("S3Q03") && scope.departure_reasons.includes("licenciement")) {
          beats.push({ mainId: "departures", childBeatId: "dismissal_technical" });
        }
      } else if (qId === "interns" && scope.interns === true) {
        beats.push({ mainId: "interns", childBeatId: "intern_types" });
      }
    }

    return beats;
  }, [availableQuestionIds, hasTable, scope]);

  // Active beat
  const [activeBeat, setActiveBeat] = useState<BeatDefinition>(() => {
    const firstUnansweredQ = availableQuestionIds.find((qId) => !isQuestionComplete(qId, initialScope));
    return { mainId: firstUnansweredQ ?? availableQuestionIds[0] ?? "recruitment" };
  });

  // Review screen shown once every quiz question is answered: a table of the
  // answers the respondent can check (and click to change) before the
  // statistical tables open. Returning to a finished quiz lands here too.
  const [isReviewing, setIsReviewing] = useState<boolean>(
    () =>
      Boolean(data._scopeConfig) &&
      availableQuestionIds.length > 0 &&
      availableQuestionIds.every((qId) => isQuestionComplete(qId, initialScope))
  );

  const [showDroppedDataModal, setShowDroppedDataModal] = useState(false);
  const [pendingNoEvent, setPendingNoEvent] = useState<PrimaryQuestionId | null>(null);
  const [showPlausibilityModal, setShowPlausibilityModal] = useState(false);

  // Commit scope choices to official FormData status keys
  const commitScopeToFormData = useCallback(
    (finalScope: ScopeState) => {
      const activeCsps = new Set<string>();
      const activeAges = new Set<string>();

      if (finalScope.applications === true) {
        finalScope.application_csp?.forEach((c) => activeCsps.add(c));
        finalScope.application_age?.forEach((a) => activeAges.add(a));
      }
      if (finalScope.recruit === true) {
        finalScope.recruit_csp?.forEach((c) => activeCsps.add(c));
        finalScope.recruit_age?.forEach((a) => activeAges.add(a));
      }
      if (finalScope.primo_seekers === true) {
        finalScope.primo_seekers_csp?.forEach((c) => activeCsps.add(c));
        finalScope.primo_seekers_age?.forEach((a) => activeAges.add(a));
      }
      if (finalScope.primo_workers === true) {
        finalScope.primo_workers_csp?.forEach((c) => activeCsps.add(c));
        finalScope.primo_workers_age?.forEach((a) => activeAges.add(a));
      }

      onChange("_scopeConfig", finalScope);
      onChange("_scopeCsp", Array.from(activeCsps));
      onChange("_scopeAge", Array.from(activeAges));

      // Statuses follow the quiz answers (QuizSemantics). A question still
      // unanswered writes nothing: it must never become NONE by default.
      const written = new Set<string>();
      for (const mapping of Object.values(EVENT_TABLE_MAPPING)) {
        for (const tableCode of mapping.tableCodes) {
          const field = getTable(tableCode);
          if (!field) continue;
          const status = deriveQuizTableStatus(tableCode, finalScope, hasTable);
          if (!status) continue;
          const statusKey = resolveTableStatusFieldId(field, data);
          if (written.has(statusKey)) continue;
          written.add(statusKey);
          if (data[statusKey] === "NOT_APPLICABLE") continue;
          onChange(statusKey, status);
        }
      }
    },
    [data, getTable, hasTable, onChange]
  );

  const handleUpdateScope = (partial: Partial<ScopeState>) => {
    let updated = { ...scope, ...partial };
    // Rule: if licenciement is unselected, clear dismissal_technical
    if (partial.departure_reasons !== undefined) {
      if (!partial.departure_reasons.includes("licenciement") && updated.dismissal_technical !== null) {
        updated = { ...updated, dismissal_technical: null };
      }
    }
    setScope(updated);
    commitScopeToFormData(updated);
  };

  // Check if every table would be NONE
  const isGlobalNone = useMemo(() => {
    if (scope.applications === true) return false;
    if (scope.recruit === true) return false;
    if (scope.primo_seekers === true) return false;
    if (scope.primo_workers === true) return false;
    if (scope.departures === true) return false;
    if (scope.interns === true && scope.intern_types.length > 0) return false;
    if (scope.skills_needs === true) return false;
    if (scope.training_needs === true) return false;
    return true;
  }, [scope]);

  // Helper to purge all cell/text keys belonging to tables configured as NONE
  const purgeAllDroppedTablesData = useCallback(
    (targetScope: ScopeState) => {
      for (const [tableCode, prefixes] of Object.entries(TABLE_PREFIX_MAP)) {
        if (hasTable(tableCode) && !isTableReported(tableCode, targetScope)) {
          const keys = findKeysMatchingPrefixes(data, prefixes);
          for (const k of keys) {
            onChange(k, undefined);
          }
        }
      }
    },
    [data, hasTable, onChange]
  );

  // Check if any previously entered figures for tables now set to NONE will be excluded
  const hasDroppedDataWarning = useMemo(() => {
    const checkTableDropped = (code: string) => {
      if (!isTableReported(code, scope) && hasTable(code)) {
        const prefixes = TABLE_PREFIX_MAP[code] ?? [code.toLowerCase() + "_"];
        const keys = findKeysMatchingPrefixes(data, prefixes);
        return hasEnteredData(data, keys);
      }
      return false;
    };

    for (const code of Object.keys(TABLE_PREFIX_MAP)) {
      if (checkTableDropped(code)) return true;
    }
    return false;
  }, [data, hasTable, scope]);

  // Proceed to the statistical tables: checks plausibility and dropped data.
  // From the review screen the dropped-data warning is already shown inline.
  const handleFinalProceed = useCallback(
    (fromReview = false) => {
      if (isGlobalNone) {
        setShowPlausibilityModal(true);
        return;
      }
      if (hasDroppedDataWarning && !fromReview) {
        setPendingNoEvent(null);
        setShowDroppedDataModal(true);
        return;
      }
      if (hasDroppedDataWarning) {
        purgeAllDroppedTablesData(scope);
      }
      commitScopeToFormData(scope);
      onComplete();
    },
    [commitScopeToFormData, hasDroppedDataWarning, isGlobalNone, onComplete, purgeAllDroppedTablesData, scope]
  );

  // End of the quiz: show the answers for checking instead of jumping straight to the tables.
  const openReview = useCallback(() => {
    setIsReviewing(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Immediate "Oui" click handler: writes row immediately, switches to first child beat
  const handleSelectMainYes = useCallback(
    (mainId: PrimaryQuestionId) => {
      let updated: ScopeState = { ...scope };
      switch (mainId) {
        case "applications":
          updated.applications = true;
          break;
        case "recruitment":
          updated.recruit = true;
          break;
        case "primo_seekers":
          updated.primo_seekers = true;
          break;
        case "primo_workers":
          updated.primo_workers = true;
          break;
        case "departures":
          updated.departures = true;
          break;
        case "interns":
          updated.interns = true;
          break;
        case "skills":
          updated.skills_needs = true;
          break;
        case "training":
          updated.training_needs = true;
          break;
      }

      setScope(updated);
      commitScopeToFormData(updated);

      // Determine next beat
      if (mainId === "applications") {
        setActiveBeat({ mainId: "applications", childBeatId: "application_csp" });
      } else if (mainId === "recruitment") {
        const firstChild: ChildBeatId = hasTable("S22Q02")
          ? "recruit_types"
          : isAdministrationLayout(hasTable)
            ? "recruit_age"
            : "recruit_csp";
        setActiveBeat({ mainId: "recruitment", childBeatId: firstChild });
      } else if (mainId === "primo_seekers") {
        setActiveBeat({ mainId: "primo_seekers", childBeatId: "primo_seekers_csp" });
      } else if (mainId === "primo_workers") {
        setActiveBeat({ mainId: "primo_workers", childBeatId: "primo_workers_types" });
      } else if (mainId === "departures") {
        setActiveBeat({ mainId: "departures", childBeatId: "departure_reasons" });
      } else if (mainId === "interns") {
        setActiveBeat({ mainId: "interns", childBeatId: "intern_types" });
      } else {
        // Main without children -> move to next main question or complete
        const currIdx = availableQuestionIds.indexOf(mainId);
        if (currIdx < availableQuestionIds.length - 1) {
          setActiveBeat({ mainId: availableQuestionIds[currIdx + 1] });
        } else {
          openReview();
        }
      }
    },
    [availableQuestionIds, commitScopeToFormData, openReview, hasTable, scope]
  );

  // Helper to atomically apply "Non" to an event: clears its cell/text data, updates scope, commits status to NONE
  const applyEventNo = useCallback(
    (mainId: PrimaryQuestionId) => {
      const mapping = EVENT_TABLE_MAPPING[mainId];
      if (mapping) {
        const keysToClear = findKeysMatchingPrefixes(data, mapping.prefixes);
        for (const k of keysToClear) {
          onChange(k, undefined);
        }
      }

      const updated: ScopeState = {
        ...scope,
        ...(mapping ? mapping.resetScope : {}),
      };

      setScope(updated);
      commitScopeToFormData(updated);

      const currIdx = availableQuestionIds.indexOf(mainId);
      if (currIdx < availableQuestionIds.length - 1) {
        setActiveBeat({ mainId: availableQuestionIds[currIdx + 1] });
      } else {
        openReview();
      }
    },
    [availableQuestionIds, commitScopeToFormData, data, onChange, openReview, scope]
  );

  // Immediate "Non" click handler: prompts confirmation if entered figures exist, else applies immediately
  const handleSelectMainNo = useCallback(
    (mainId: PrimaryQuestionId) => {
      if (hasEnteredDataForEvent(mainId, data, hasTable)) {
        setPendingNoEvent(mainId);
        setShowDroppedDataModal(true);
        return;
      }
      applyEventNo(mainId);
    },
    [applyEventNo, data, hasTable]
  );

  // Answers are already committed by handleUpdateScope, handleSelectMainYes,
  // and handleSelectMainNo. Committing again here rewrites every status key
  // and retriggers autosave. The closing commit stays in handleFinalProceed.
  const handleContinue = useCallback(() => {
    const currentBeatIdx = orderedBeats.findIndex(
      (b) => b.mainId === activeBeat.mainId && b.childBeatId === activeBeat.childBeatId
    );

    if (currentBeatIdx >= 0 && currentBeatIdx < orderedBeats.length - 1) {
      setActiveBeat(orderedBeats[currentBeatIdx + 1]);
    } else {
      openReview();
    }
  }, [activeBeat, openReview, orderedBeats]);

  // Sequential backward navigation across ordered beats
  const handlePrev = useCallback(() => {
    const currentBeatIdx = orderedBeats.findIndex(
      (b) => b.mainId === activeBeat.mainId && b.childBeatId === activeBeat.childBeatId
    );
    if (currentBeatIdx > 0) {
      setActiveBeat(orderedBeats[currentBeatIdx - 1]);
      gentleScrollToTop();
    } else {
      onBack();
    }
  }, [activeBeat, gentleScrollToTop, onBack, orderedBeats]);

  // Group jump from top indicator
  const handleSelectGroup = useCallback(
    (groupId: "emploi" | "primo" | "departs" | "stages") => {
      switch (groupId) {
        case "emploi": {
          const target = availableQuestionIds.find((q) => q === "applications" || q === "recruitment");
          if (target) {
            setActiveBeat({ mainId: target });
            gentleScrollToTop();
          }
          break;
        }
        case "primo": {
          const target = availableQuestionIds.find((q) => q === "primo_seekers" || q === "primo_workers");
          if (target) {
            setActiveBeat({ mainId: target });
            gentleScrollToTop();
          }
          break;
        }
        case "departs": {
          if (availableQuestionIds.includes("departures")) {
            setActiveBeat({ mainId: "departures" });
            gentleScrollToTop();
          }
          break;
        }
        case "stages": {
          const target = availableQuestionIds.find((q) => q === "interns" || q === "skills" || q === "training");
          if (target) {
            setActiveBeat({ mainId: target });
            gentleScrollToTop();
          }
          break;
        }
      }
    },
    [availableQuestionIds, gentleScrollToTop]
  );

  // Compute progress groups (Faits ● Emploi ○ Départs ○ Stages)
  const progressGroups: ProgressGroup[] = useMemo(() => {
    const grps: ProgressGroup[] = [];

    const hasEmploi = availableQuestionIds.some((q) => q === "applications" || q === "recruitment");
    if (hasEmploi) {
      const emploiQuestions = availableQuestionIds.filter((q) => q === "applications" || q === "recruitment");
      const isComplete = emploiQuestions.every((q) => isQuestionComplete(q, scope));
      const isActive = activeBeat.mainId === "applications" || activeBeat.mainId === "recruitment";
      grps.push({
        id: "emploi",
        label: t("groupEmployment"),
        isComplete,
        isActive,
      });
    }

    const hasPrimo = availableQuestionIds.some((q) => q === "primo_seekers" || q === "primo_workers");
    if (hasPrimo) {
      const primoQuestions = availableQuestionIds.filter((q) => q === "primo_seekers" || q === "primo_workers");
      const isComplete = primoQuestions.every((q) => isQuestionComplete(q, scope));
      const isActive = activeBeat.mainId === "primo_seekers" || activeBeat.mainId === "primo_workers";
      grps.push({
        id: "primo",
        label: t("groupFirstJob"),
        isComplete,
        isActive,
      });
    }

    const hasDeparts = availableQuestionIds.some((q) => q === "departures");
    if (hasDeparts) {
      const isComplete = isQuestionComplete("departures", scope);
      const isActive = activeBeat.mainId === "departures";
      grps.push({
        id: "departs",
        label: t("groupDepartures"),
        isComplete,
        isActive,
      });
    }

    const hasStages = availableQuestionIds.some((q) => q === "interns" || q === "skills" || q === "training");
    if (hasStages) {
      const stagesQuestions = availableQuestionIds.filter(
        (q) => q === "interns" || q === "skills" || q === "training"
      );
      const isComplete = stagesQuestions.every((q) => isQuestionComplete(q, scope));
      const isActive =
        activeBeat.mainId === "interns" || activeBeat.mainId === "skills" || activeBeat.mainId === "training";
      grps.push({
        id: "stages",
        label: t("groupInternships"),
        isComplete,
        isActive,
      });
    }

    return grps;
  }, [availableQuestionIds, activeBeat.mainId, isQuestionComplete, scope, t]);

  const handleConfirmGlobalNone = useCallback(() => {
    setShowPlausibilityModal(false);
    purgeAllDroppedTablesData(scope);
    commitScopeToFormData(scope);
    onComplete();
  }, [commitScopeToFormData, onComplete, purgeAllDroppedTablesData, scope]);

  // Synchronize with external navigation buttons
  useEffect(() => {
    if (!navigationRef) return;
    navigationRef.current = {
      onPrev: () => {
        if (isReviewing) {
          setIsReviewing(false);
          if (orderedBeats.length > 0) setActiveBeat(orderedBeats[orderedBeats.length - 1]);
          return true;
        }
        const currentBeatIdx = orderedBeats.findIndex(
          (b) => b.mainId === activeBeat.mainId && b.childBeatId === activeBeat.childBeatId
        );
        if (currentBeatIdx > 0) {
          setActiveBeat(orderedBeats[currentBeatIdx - 1]);
          gentleScrollToTop();
          return true;
        }
        return false; // let parent exit to Section 1
      },
      onNext: () => {
        if (isReviewing) handleFinalProceed(true);
        else handleContinue();
        return true;
      },
    };
    return () => {
      navigationRef.current = null;
    };
  }, [navigationRef, activeBeat, orderedBeats, handleContinue, gentleScrollToTop, isReviewing, handleFinalProceed]);

  // Rows of the review table: one per answered question, with the chosen
  // categories, ages, diplomas, reasons… Clicking a cell reopens that question.
  const trackerRows = useMemo<TrackerRow[]>(() => {
    const pick = (options: FilterOption[], ids: string[]): TrackerChipItem[] =>
      options
        .filter((o) => ids.includes(o.id))
        .map((o) => ({
          label: (locale === "en" ? o.shortEn ?? o.en : o.shortFr ?? o.fr) as string,
          tooltip: locale === "en" ? o.en : o.fr,
        }));
    const yesNo = (v: boolean | null) => (v === null ? null : v ? tFacts("yes") : tFacts("no"));
    const answer = (v: boolean | null): "Oui" | "Non" | null => (v === null ? null : v ? "Oui" : "Non");
    const other = (label: string, v: boolean | null): TrackerChipItem[] =>
      v === null ? [] : [{ label: tFacts("other.item", { label, answer: yesNo(v) ?? "" }) }];

    const rows: TrackerRow[] = [];
    for (const qId of availableQuestionIds) {
      switch (qId) {
        case "applications":
          if (scope.applications === null) break;
          rows.push({
            mainId: qId,
            title: tFacts("row.applications"),
            reponse: answer(scope.applications),
            personnels: pick(CSP_OPTIONS, scope.application_csp),
            ages: pick(AGE_BAND_OPTIONS, scope.application_age),
            cellBeats: { personnels: "application_csp", ages: "application_age" },
          });
          break;
        case "recruitment":
          if (scope.recruit === null) break;
          rows.push({
            mainId: qId,
            title: tFacts("row.recruitment"),
            reponse: answer(scope.recruit),
            typesMotifs: pick(RECRUITMENT_TYPE_OPTIONS, scope.recruit_types),
            personnels: pick(CSP_OPTIONS, scope.recruit_csp),
            ages: pick(AGE_BAND_OPTIONS, scope.recruit_age),
            diplomes: pick(DIPLOMA_OPTIONS, scope.recruit_diploma),
            autre: [
              ...other(tFacts("other.disability"), scope.disability),
              ...other(tFacts("other.vulnerable"), scope.vulnerable),
            ],
            cellBeats: {
              typesMotifs: "recruit_types",
              personnels: "recruit_csp",
              ages: "recruit_age",
              diplomes: "recruit_diploma",
              autre: "recruit_disability",
            },
          });
          break;
        case "primo_seekers":
          if (scope.primo_seekers === null) break;
          rows.push({
            mainId: qId,
            title: tFacts("row.primoSeekers"),
            reponse: answer(scope.primo_seekers),
            personnels: pick(CSP_OPTIONS, scope.primo_seekers_csp),
            ages: pick(AGE_BAND_OPTIONS, scope.primo_seekers_age),
            cellBeats: { personnels: "primo_seekers_csp", ages: "primo_seekers_age" },
          });
          break;
        case "primo_workers":
          if (scope.primo_workers === null) break;
          rows.push({
            mainId: qId,
            title: tFacts("row.primoWorkers"),
            reponse: answer(scope.primo_workers),
            typesMotifs: pick(RECRUITMENT_TYPE_OPTIONS, scope.primo_workers_types),
            personnels: pick(CSP_OPTIONS, scope.primo_workers_csp),
            ages: pick(AGE_BAND_OPTIONS, scope.primo_workers_age),
            cellBeats: { typesMotifs: "primo_workers_types", personnels: "primo_workers_csp", ages: "primo_workers_age" },
          });
          break;
        case "departures":
          if (scope.departures === null) break;
          rows.push({
            mainId: qId,
            title: tFacts("row.departures"),
            reponse: answer(scope.departures),
            typesMotifs: pick(DEPARTURE_REASON_OPTIONS, scope.departure_reasons),
            autre: other(tFacts("other.technical"), scope.dismissal_technical),
            cellBeats: { typesMotifs: "departure_reasons", autre: "dismissal_technical" },
          });
          break;
        case "interns":
          if (scope.interns === null) break;
          rows.push({
            mainId: qId,
            title: tFacts("row.interns"),
            reponse: answer(scope.interns),
            typesMotifs: pick(INTERNSHIP_TYPE_OPTIONS, scope.intern_types),
            cellBeats: { typesMotifs: "intern_types" },
          });
          break;
        case "skills":
          if (scope.skills_needs === null) break;
          rows.push({ mainId: qId, title: tFacts("row.skills"), reponse: answer(scope.skills_needs) });
          break;
        case "training":
          if (scope.training_needs === null) break;
          rows.push({ mainId: qId, title: tFacts("row.training"), reponse: answer(scope.training_needs) });
          break;
      }
    }
    return rows;
  }, [availableQuestionIds, locale, scope, tFacts]);

  const handleSelectBeatFromReview = useCallback(
    (beat: BeatDefinition) => {
      setIsReviewing(false);
      setActiveBeat(beat);
      gentleScrollToTop();
    },
    [gentleScrollToTop]
  );

  // Active beat index in ordered beats
  const activeBeatIndex = useMemo(() => {
    const idx = orderedBeats.findIndex(
      (b) => b.mainId === activeBeat.mainId && b.childBeatId === activeBeat.childBeatId
    );
    return idx >= 0 ? idx : 0;
  }, [activeBeat, orderedBeats]);

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "var(--vt-content-max, 940px)",
        margin: "0 auto",
        padding: "0 4px",
      }}
    >
      {/* Title and Subtitle */}
      <div style={{ marginBottom: 12 }}>
        <h1
          style={{
            fontSize: "clamp(20px, 2.5vw, 24px)",
            fontWeight: 700,
            color: "var(--cam-text)",
            margin: "0 0 6px",
            letterSpacing: "-0.01em",
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--cam-text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {t("intro")}
        </p>
      </div>

      <div style={{ width: "100%" }}>
        {isReviewing ? (
          <FactsReview
            rows={trackerRows}
            activeBeat={{ mainId: "__none__" as PrimaryQuestionId }}
            onSelectBeat={handleSelectBeatFromReview}
            hasDroppedDataWarning={hasDroppedDataWarning}
            onModify={() => handleSelectBeatFromReview(orderedBeats[0] ?? { mainId: availableQuestionIds[0] })}
            onConfirmProceed={() => handleFinalProceed(true)}
            locale={locale}
          />
        ) : (
        <EventQuestion
          beat={activeBeat}
          beatIndex={activeBeatIndex}
          totalBeats={orderedBeats.length}
          isFirstBeat={activeBeatIndex === 0}
          isLastBeat={activeBeatIndex === orderedBeats.length - 1}
          scope={scope}
          onUpdateScope={handleUpdateScope}
          onPrev={handlePrev}
          onContinue={handleContinue}
          onSelectMainYes={handleSelectMainYes}
          onSelectMainNo={handleSelectMainNo}
          hasTable={hasTable}
          isEnterprise={isEnterprise}
          locale={locale}
          headerSlot={
            <EventProgress
              groups={progressGroups}
              onSelectGroup={handleSelectGroup}
              locale={locale}
              inCard={true}
            />
          }
        />
        )}
      </div>

      {/* Dropped Data Warning Modal (if modifying previous answers excludes existing entries) */}
      {showDroppedDataModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dropped-data-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--cam-surface)",
              border: "1px solid var(--cam-border)",
              borderRadius: "var(--cam-radius-md, 8px)",
              padding: "clamp(20px, 4vw, 28px)",
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 24 }} aria-hidden="true">
                ⚠️
              </span>
              <h3
                id="dropped-data-modal-title"
                style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--cam-text)" }}
              >
                {t("excludedTitle")}
              </h3>
            </div>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--cam-text-muted)",
                lineHeight: 1.5,
                margin: "0 0 20px",
              }}
            >
              {t("excludedBody")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setShowDroppedDataModal(false);
                  setPendingNoEvent(null);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--cam-border)",
                  borderRadius: "var(--cam-radius-sm, 6px)",
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("modifyQuiz")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDroppedDataModal(false);
                  if (pendingNoEvent) {
                    const target = pendingNoEvent;
                    setPendingNoEvent(null);
                    applyEventNo(target);
                  } else {
                    purgeAllDroppedTablesData(scope);
                    commitScopeToFormData(scope);
                    onComplete();
                  }
                }}
                style={{
                  background: "var(--cam-green)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--cam-radius-sm, 6px)",
                  padding: "9px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("confirmOpen")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global-NONE Plausibility Modal */}
      {showPlausibilityModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="plausibility-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--cam-surface)",
              border: "1px solid var(--cam-border)",
              borderRadius: "var(--cam-radius-md, 8px)",
              padding: "clamp(20px, 4vw, 28px)",
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}
          >
            <h3
              id="plausibility-modal-title"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "var(--cam-text)",
                margin: "0 0 10px",
              }}
            >
              {t("nilTitle")}
            </h3>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--cam-text-muted)",
                lineHeight: 1.5,
                margin: "0 0 20px",
              }}
            >
              {t("nilBody")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowPlausibilityModal(false)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--cam-border)",
                  borderRadius: "var(--cam-radius-sm, 6px)",
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("reviewFacts")}
              </button>
              <button
                type="button"
                onClick={handleConfirmGlobalNone}
                style={{
                  background: "var(--cam-green)",
                  border: "none",
                  borderRadius: "var(--cam-radius-sm, 6px)",
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                {t("confirmNil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Aliases for compatibility
export const ScopeConfigurationWizard = EventFactInterview;
export type ScopeConfigurationWizardProps = EventFactInterviewProps;
