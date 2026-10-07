"use client";

import React, { useState, useId, useRef, useEffect, useLayoutEffect, useMemo, useCallback, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData } from "@/lib/onefop-schema";
import type {
  FixedMatrixDefinition,
} from "./StatisticalTableDefinition";
import { resolveGuidedScope, type GuidedQuestionItem } from "./resolveGuidedScope";
import { useGuidedReviewGate } from "./GuidedReviewGate";

export interface GuidedStatisticalEntryProps {
  definition: FixedMatrixDefinition;
  data: FormData;
  onChange: (fieldKey: string, value: unknown) => void;
  onBatchChange?: (updates: Record<string, unknown>) => void;
  className?: string;
  disabled?: boolean;
  onOpenScope?: () => void;
  /** Kept for callers; Guidé moves on with the wizard's own Continuer (single primary action). */
  onAdvanceTable?: () => void;
}

type Gender = "female" | "male";

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== "";

function findGenderBreakdowns(q: GuidedQuestionItem) {
  const maleB = q.breakdowns.find(
    (b) => b.key === "male" || b.fieldKey.toLowerCase().includes("male") || b.fieldKey.toLowerCase().includes("homme") || b.label.toLowerCase().includes("homme") || b.label.toLowerCase().includes("men")
  );
  const femaleB = q.breakdowns.find(
    (b) => b.key === "female" || b.fieldKey.toLowerCase().includes("female") || b.fieldKey.toLowerCase().includes("femme") || b.label.toLowerCase().includes("femme") || b.label.toLowerCase().includes("women")
  );
  const isGenderSplit = Boolean(maleB && femaleB && q.breakdowns.length === 2);
  return { maleB, femaleB, isGenderSplit };
}

/**
 * Guided Statistical Entry — one question per screen.
 *
 * The questions come from `resolveGuidedScope`, i.e. only the categories and
 * age groups kept by the preliminary quiz (EventFactInterview). Each screen
 * shows its context (category · dimension + contract type), the question, a
 * total, and — when the total is above 0 — the women/men split with the other
 * gender deduced automatically. The wizard's bottom Continuer / Précédent step
 * through the questions via the GuidedReviewGate `advance` / `retreat` hooks;
 * after the last question the official summary table opens for confirmation.
 *
 * Data writes are unchanged from the previous continuous-scroll version: the
 * same field keys, totals and zero-fill values are committed.
 */
export function GuidedStatisticalEntry({
  definition,
  data,
  onChange,
  onBatchChange,
  className = "",
  disabled = false,
  onOpenScope,
}: GuidedStatisticalEntryProps) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const isEn = locale === "en";
  const t = useTranslations("modernJobs.guided");
  const baseId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const reviewRegistry = useGuidedReviewGate();

  // Scope-pruned conversational questions (rows/age bands already filtered
  // by the quiz answers in resolveTableScope).
  const { questions } = useMemo(
    () => resolveGuidedScope(definition, data, locale),
    [definition, data, locale]
  );

  const isQuestionAnswered = useCallback(
    (q: GuidedQuestionItem): boolean => q.breakdowns.some((b) => hasValue(data[b.fieldKey])),
    [data]
  );

  const firstUnansweredIndex = useCallback(() => {
    const idx = questions.findIndex((q) => !isQuestionAnswered(q));
    return idx === -1 ? 0 : idx;
  }, [questions, isQuestionAnswered]);

  const unansweredQuestions = useMemo(
    () => questions.filter((q) => !isQuestionAnswered(q)),
    [questions, isQuestionAnswered]
  );
  const allAnswered = unansweredQuestions.length === 0 && questions.length > 0;

  // Summary (official table) — opens after the last question. A table that
  // is already fully answered (resumed draft, or coming back from the next
  // table) opens straight on its summary.
  const [isReviewStage, setIsReviewStage] = useState<boolean>(allAnswered);
  const [currentIdx, setCurrentIdx] = useState<number>(() => firstUnansweredIndex());
  const [error, setError] = useState<string | null>(null);

  // Per-question typed total inputs (cache string values while typing)
  const [targetTotalInputs, setTargetTotalInputs] = useState<Record<string, string>>({});
  // Per-question typed split value (kept locally so an over-total entry can be
  // flagged instead of being silently clamped)
  const [splitDrafts, setSplitDrafts] = useState<Record<string, string>>({});
  // Which gender the respondent prefers entering first per question (default: women)
  const [preferredFirstGender, setPreferredFirstGender] = useState<Record<string, Gender>>({});

  // Reset when switching table / CSP slice (state reset during render —
  // avoids a setState-in-effect cascade).
  const resetKey = `${definition.id}|${definition.activeCsp ?? ""}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setIsReviewStage(allAnswered);
    setCurrentIdx(firstUnansweredIndex());
    setError(null);
    setTargetTotalInputs({});
    setSplitDrafts({});
  }

  const safeIdx = Math.min(Math.max(0, currentIdx), Math.max(0, questions.length - 1));
  const q: GuidedQuestionItem | undefined = questions[safeIdx];

  const answeredCount = questions.length - unansweredQuestions.length;

  // ── Commit helpers (same writes as before) ──
  const handleCommitUpdates = (updates: Record<string, unknown>) => {
    if (onBatchChange) {
      onBatchChange(updates);
    } else {
      Object.entries(updates).forEach(([k, v]) => onChange(k, v));
    }
  };

  const displayTotalFor = (qq: GuidedQuestionItem): string => {
    const raw = targetTotalInputs[qq.id];
    if (raw !== undefined) return raw;
    const hasAny = qq.breakdowns.some((b) => hasValue(data[b.fieldKey]));
    const total = qq.getCurrentTotal(data);
    return hasAny || total > 0 ? String(total) : "";
  };

  const readNum = (fieldKey?: string): number | null =>
    fieldKey && hasValue(data[fieldKey]) ? Number(data[fieldKey]) : null;

  // Primary total. For a gender split, a known primary-gender value is kept and
  // the other gender re-deduced when the total changes.
  const handleTargetTotalChange = (qq: GuidedQuestionItem, valStr: string) => {
    const clean = valStr.replace(/\D/g, "");
    setTargetTotalInputs((prev) => ({ ...prev, [qq.id]: clean }));
    setError(null);

    if (clean === "") {
      const updates: Record<string, unknown> = {};
      if (qq.totalFieldKey) updates[qq.totalFieldKey] = null;
      qq.breakdowns.forEach((b) => {
        updates[b.fieldKey] = null;
      });
      setSplitDrafts((prev) => ({ ...prev, [qq.id]: "" }));
      handleCommitUpdates(updates);
      return;
    }

    const parsed = parseInt(clean, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;

    if (parsed === 0) {
      const updates: Record<string, unknown> = {};
      if (qq.totalFieldKey) updates[qq.totalFieldKey] = 0;
      qq.breakdowns.forEach((b) => {
        updates[b.fieldKey] = 0;
      });
      setSplitDrafts((prev) => ({ ...prev, [qq.id]: "" }));
      handleCommitUpdates(updates);
      return;
    }

    if (qq.breakdowns.length === 1) {
      const updates: Record<string, unknown> = {
        [qq.breakdowns[0].fieldKey]: parsed,
      };
      if (qq.totalFieldKey) updates[qq.totalFieldKey] = parsed;
      handleCommitUpdates(updates);
      return;
    }

    const { maleB, femaleB, isGenderSplit } = findGenderBreakdowns(qq);
    if (isGenderSplit && maleB && femaleB) {
      const first = preferredFirstGender[qq.id] || "female";
      const primaryKey = first === "female" ? femaleB.fieldKey : maleB.fieldKey;
      const draft = splitDrafts[qq.id];
      const primary = draft !== undefined && draft !== "" ? Number(draft) : readNum(primaryKey);
      if (primary != null && primary <= parsed) {
        const secondary = parsed - primary;
        const updates: Record<string, unknown> = {
          [femaleB.fieldKey]: first === "female" ? primary : secondary,
          [maleB.fieldKey]: first === "female" ? secondary : primary,
        };
        if (qq.totalFieldKey) updates[qq.totalFieldKey] = parsed;
        handleCommitUpdates(updates);
      }
    }
  };

  // Smart split: the respondent types one gender, the other is deduced.
  const handleGenderSplitChange = (qq: GuidedQuestionItem, primaryGender: Gender, rawVal: string, totalCount: number) => {
    const { maleB, femaleB } = findGenderBreakdowns(qq);
    if (!maleB || !femaleB) return;
    const clean = rawVal.replace(/\D/g, "");
    setSplitDrafts((prev) => ({ ...prev, [qq.id]: clean }));

    if (clean === "") {
      setError(null);
      handleCommitUpdates({
        [primaryGender === "female" ? femaleB.fieldKey : maleB.fieldKey]: null,
      });
      return;
    }

    const parsedPrimary = parseInt(clean, 10);
    if (Number.isNaN(parsedPrimary) || parsedPrimary < 0) return;

    if (parsedPrimary > totalCount) {
      // Not committed: flagged so the respondent corrects it (no silent clamp).
      setError(t("cannotExceedTotal", { total: totalCount }));
      return;
    }
    setError(null);

    const deducedSecondary = totalCount - parsedPrimary;
    const updates: Record<string, unknown> = {
      [femaleB.fieldKey]: primaryGender === "female" ? parsedPrimary : deducedSecondary,
      [maleB.fieldKey]: primaryGender === "female" ? deducedSecondary : parsedPrimary,
    };
    if (qq.totalFieldKey) updates[qq.totalFieldKey] = totalCount;
    handleCommitUpdates(updates);
  };

  // General sub-breakdown numeric input change for multi-category tables (>2 breakdowns)
  const handleGeneralBreakdownChange = (qq: GuidedQuestionItem, fieldKey: string, rawVal: string) => {
    let val: number | null = null;
    if (rawVal !== "") {
      const parsed = parseInt(rawVal, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        val = parsed;
      }
    }
    setError(null);

    const updates: Record<string, unknown> = { [fieldKey]: val };
    let newSum = 0;
    let anyFilled = false;
    qq.breakdowns.forEach((b) => {
      const curV = b.fieldKey === fieldKey ? val : readNum(b.fieldKey);
      if (curV != null) {
        newSum += curV;
        anyFilled = true;
      }
    });
    if (qq.totalFieldKey) {
      updates[qq.totalFieldKey] = anyFilled ? newSum : null;
    }
    const curTarget = targetTotalInputs[qq.id];
    if (anyFilled && (!curTarget || Number(curTarget) === 0)) {
      setTargetTotalInputs((prev) => ({ ...prev, [qq.id]: String(newSum) }));
    }
    handleCommitUpdates(updates);
  };

  // Auto-fill remainder into first unfilled/zero breakdown
  const handleAutoFillRemainder = (qq: GuidedQuestionItem, target: number, currentSum: number) => {
    if (target <= currentSum) return;
    const remainder = target - currentSum;
    const emptyB =
      qq.breakdowns.find((b) => !hasValue(data[b.fieldKey]) || Number(data[b.fieldKey]) === 0) ||
      qq.breakdowns[qq.breakdowns.length - 1];
    if (emptyB) {
      const curVal = Number(data[emptyB.fieldKey] ?? 0);
      const updates: Record<string, unknown> = { [emptyB.fieldKey]: curVal + remainder };
      if (qq.totalFieldKey) updates[qq.totalFieldKey] = target;
      setError(null);
      handleCommitUpdates(updates);
    }
  };

  const handleClearQuestion = (qq: GuidedQuestionItem) => {
    const updates: Record<string, null> = {};
    if (qq.totalFieldKey) updates[qq.totalFieldKey] = null;
    qq.breakdowns.forEach((b) => {
      updates[b.fieldKey] = null;
    });
    setTargetTotalInputs((prev) => {
      const next = { ...prev };
      delete next[qq.id];
      return next;
    });
    setSplitDrafts((prev) => {
      const next = { ...prev };
      delete next[qq.id];
      return next;
    });
    setError(null);
    handleCommitUpdates(updates);
  };

  // ── Validation of the current screen (structural, blocks Continuer only
  // for an unanswered or internally inconsistent question) ──
  const validateQuestion = (qq: GuidedQuestionItem): string | null => {
    const totalStr = displayTotalFor(qq);
    if (totalStr === "") {
      return t("enterTotalOrNone");
    }
    const target = parseInt(totalStr, 10);
    if (qq.textField && target > 0 && !String(data[qq.textField.fieldKey] ?? "").trim()) {
      return t("specifyTextField", { field: qq.textField.label.replace(/\s*\d+$/, "").toLowerCase() });
    }
    if (target === 0 || qq.breakdowns.length <= 1) return null;

    const { maleB, femaleB, isGenderSplit } = findGenderBreakdowns(qq);
    if (isGenderSplit && maleB && femaleB) {
      const draft = splitDrafts[qq.id];
      if (draft !== undefined && draft !== "" && Number(draft) > target) {
        return t("cannotExceedTotal", { total: target });
      }
      const m = readNum(maleB.fieldKey);
      const f = readNum(femaleB.fieldKey);
      if (m == null || f == null || m + f !== target) {
        return t("enterWomenCount");
      }
      return null;
    }

    const sum = qq.breakdowns.reduce((acc, b) => acc + (readNum(b.fieldKey) ?? 0), 0);
    if (sum < target) {
      return t("remainingToDistributeSentence", { count: target - sum });
    }
    if (sum > target) {
      return t("exceedsTotalSentence", { count: sum - target });
    }
    return null;
  };

  // Focus the first input of the screen after a step (not on first mount).
  const focusAfterStepRef = useRef(false);
  useEffect(() => {
    if (!focusAfterStepRef.current) return;
    focusAfterStepRef.current = false;
    const root = containerRef.current;
    if (!root) return;
    root.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const input = root.querySelector<HTMLInputElement>("input:not([disabled])");
    if (input) {
      input.focus();
      input.select();
    }
  }, [safeIdx, isReviewStage]);

  const goTo = useCallback((idx: number) => {
    focusAfterStepRef.current = true;
    setError(null);
    setIsReviewStage(false);
    setCurrentIdx(idx);
  }, []);

  const openReview = useCallback(() => {
    setError(null);
    setIsReviewStage(true);
  }, []);

  const exitReview = useCallback(() => {
    setIsReviewStage(false);
  }, []);

  const advance = (): boolean => {
    if (questions.length === 0 || isReviewStage || !q) return false;
    const err = validateQuestion(q);
    if (err) {
      setError(err);
      const root = containerRef.current;
      const bad = root?.querySelector<HTMLInputElement>("input[data-guided-primary]");
      bad?.focus();
      return true;
    }
    if (safeIdx < questions.length - 1) {
      goTo(safeIdx + 1);
    } else {
      openReview();
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return true;
  };

  const retreat = (): boolean => {
    if (questions.length === 0) return false;
    if (isReviewStage) {
      goTo(questions.length - 1);
      return true;
    }
    if (safeIdx > 0) {
      goTo(safeIdx - 1);
      return true;
    }
    return false;
  };

  // Latest step handlers for the section-level gate (read at click time).
  const advanceRef = useRef(advance);
  const retreatRef = useRef(retreat);
  // Layout effect: refreshed synchronously after each commit, so a Continuer
  // click right after "Aucun (0)" never runs a stale handler.
  useLayoutEffect(() => {
    advanceRef.current = advance;
    retreatRef.current = retreat;
  });

  // Register in section-level review gate
  useEffect(() => {
    if (!reviewRegistry) return;
    reviewRegistry.register(definition.id, {
      tableId: definition.id,
      isReviewing: isReviewStage,
      allAnswered,
      openReview,
      exitReview,
      advance: () => advanceRef.current(),
      retreat: () => retreatRef.current(),
    });
    return () => {
      reviewRegistry.unregister(definition.id);
    };
  }, [reviewRegistry, definition.id, isReviewStage, allAnswered, openReview, exitReview]);

  // Enter: total → split (if needed) → next question / summary
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const root = containerRef.current;
    const inputs = Array.from(root?.querySelectorAll<HTMLInputElement>("input:not([disabled])") || []);
    const i = inputs.indexOf(e.currentTarget);
    const next = i >= 0 ? inputs[i + 1] : undefined;
    if (next && next.value === "") {
      next.focus();
      next.select();
      return;
    }
    advance();
  };

  // ── EMPTY STATE: Scope completely excludes this table ──
  if (questions.length === 0) {
    return (
      <div
        className={`w-full flex flex-col items-center justify-center p-8 bg-[var(--cam-surface-subtle)] border border-[var(--cam-border)] rounded-[6px] text-center gap-3 font-sans ${className}`}
        data-testid={`guided-empty-${definition.id}`}
      >
        <h4 className="text-base font-bold text-[var(--cam-text)]">
          {t("noActiveCategories")}
        </h4>
        <p className="text-xs text-[var(--cam-text-muted)] max-w-md">
          {t("excludedByQuiz")}
        </p>
        {onOpenScope && (
          <button
            type="button"
            onClick={onOpenScope}
            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-white border border-[var(--cam-green)] text-[var(--cam-green)] hover:bg-[var(--cam-success-bg)] transition-colors cursor-pointer"
          >
            {t("modifyScope")}
          </button>
        )}
      </div>
    );
  }

  // ── SUMMARY: a plain list of the answers (no grid — Guidé never shows the
  // Tableau view). Each line can be reopened; the wizard's bottom Continuer
  // is the single action that moves on to the next table.
  if (isReviewStage) {
    const people = (n: number) =>
      t("people", { count: n });
    const splitText = (qq: GuidedQuestionItem) => {
      const { maleB: mB, femaleB: fB, isGenderSplit: gs } = findGenderBreakdowns(qq);
      if (gs && mB && fB) {
        const m = readNum(mB.fieldKey) ?? 0;
        const f = readNum(fB.fieldKey) ?? 0;
        return t("menWomenSplit", { men: m, women: f });
      }
      if (qq.breakdowns.length > 1) {
        return qq.getCurrentBreakdowns(data).map((b) => `${b.label} ${b.value ?? 0}`).join(" · ");
      }
      return "";
    };

    // Group lines by category (row) so the category is read once.
    const groups: { title: string; items: { q: GuidedQuestionItem; idx: number }[] }[] = [];
    questions.forEach((qq, idx) => {
      const title = qq.categoryTag || qq.rowLabel;
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.items.push({ q: qq, idx });
      else groups.push({ title, items: [{ q: qq, idx }] });
    });

    const grandTotal = questions.reduce((sum, qq) => sum + (isQuestionAnswered(qq) ? qq.getCurrentTotal(data) : 0), 0);
    const contract = questions[0]?.contractType;
    const contractLabel =
      contract === "permanent" ? t("permanentCdi")
        : contract === "temporary" ? t("temporaryCdd") : null;

    return (
      <div
        ref={containerRef}
        id={`guided-review-${definition.id}`}
        className={`w-full flex flex-col gap-4 font-sans max-w-[760px] ${className}`}
        data-testid={`guided-review-${definition.id}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[var(--cam-text)] m-0">
              {t("checkAnswers")}
            </h3>
            <p className="text-xs text-[var(--cam-text-muted)] mt-1 mb-0">
              {t("checkAnswersHint")}
            </p>
          </div>
          {contractLabel && (
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-[3px] border ${
                contract === "permanent"
                  ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                  : "text-amber-800 bg-amber-50 border-amber-200"
              }`}
            >
              {contractLabel}
            </span>
          )}
        </div>

        {!allAnswered && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 text-[13px] font-semibold px-3.5 py-2.5 rounded-[6px] border bg-[var(--cam-warning-bg)] border-[var(--cam-warning-border)] text-[var(--cam-text)]"
          >
            <span>
              {t("unansweredCount", { count: unansweredQuestions.length })}
            </span>
            <button
              type="button"
              onClick={() => goTo(firstUnansweredIndex())}
              className="underline text-[var(--cam-green)] bg-transparent border-none p-0 cursor-pointer font-semibold"
            >
              {t("answerThem")}
            </button>
          </div>
        )}

        <div className="bg-white border border-[var(--cam-border)] rounded-[8px] divide-y divide-[var(--cam-border-subtle)]">
          {groups.map((g) => (
            <div key={g.title} className="px-4 sm:px-5 py-3">
              <div className="text-[13px] font-bold text-[var(--cam-text)] mb-1">{g.title}</div>
              {g.items.map(({ q: qq, idx }) => {
                const answered = isQuestionAnswered(qq);
                const total = qq.getCurrentTotal(data);
                const typed = qq.textField ? String(data[qq.textField.fieldKey] ?? "").trim() : "";
                const ageLabel = (d?: string) => {
                  if (!d || !/^\d/.test(d)) return d;
                  if (isEn) return /^\d+ to \d+$/.test(d) ? `${d} years` : d;
                  return d.replace(/^(\d+) à (\d+)$/, "$1 à $2 ans").replace(/^(\d+) et \+$/, "$1 ans et +");
                };
                const label = typed || ageLabel(qq.dimensionTag) || t("number");
                const detail = answered && total > 0 ? splitText(qq) : "";
                return (
                  <div key={qq.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="text-[13px] text-[var(--cam-text-muted)] min-w-0">{label}</span>
                    <span className="flex items-baseline gap-3 shrink-0">
                      {answered ? (
                        <span className="text-[13px] text-[var(--cam-text)] text-right">
                          <b className="tabular-nums">{people(total)}</b>
                          {detail && <span className="text-[var(--cam-text-muted)]"> ({detail})</span>}
                        </span>
                      ) : (
                        <span className="text-[13px] font-semibold text-[var(--cam-warning)]">
                          {t("notAnswered")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => goTo(idx)}
                        className="text-xs font-semibold text-[var(--cam-green)] underline bg-transparent border-none p-0 cursor-pointer"
                      >
                        {t("change")}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="px-4 sm:px-5 py-3 flex items-baseline justify-between gap-3 bg-[var(--cam-surface-subtle)] rounded-b-[8px]">
            <span className="text-[13px] font-bold text-[var(--cam-text)]">{t("total")}</span>
            <b className="text-[13px] tabular-nums text-[var(--cam-text)]">{people(grandTotal)}</b>
          </div>
        </div>
      </div>
    );
  }

  // ── ONE QUESTION PER SCREEN ──
  if (!q) return null;
  const { maleB, femaleB, isGenderSplit } = findGenderBreakdowns(q);
  const displayTotal = displayTotalFor(q);
  const targetNum = displayTotal !== "" ? parseInt(displayTotal, 10) : null;
  const qBreakdowns = q.getCurrentBreakdowns(data);
  const hasMultipleBreakdowns = qBreakdowns.length > 1;
  const hasAnyVal = qBreakdowns.some((b) => hasValue(data[b.fieldKey]));
  const maleVal = readNum(maleB?.fieldKey);
  const femaleVal = readNum(femaleB?.fieldKey);
  const firstGender: Gender = preferredFirstGender[q.id] || "female";
  const committedPrimary = firstGender === "female" ? femaleVal : maleVal;
  const splitDraft = splitDrafts[q.id];
  const splitShown = splitDraft !== undefined ? splitDraft : committedPrimary != null ? String(committedPrimary) : "";
  const deduced =
    targetNum != null && splitShown !== "" && Number(splitShown) <= targetNum ? targetNum - Number(splitShown) : null;

  const isPermanent = q.contractType === "permanent";
  const isTemporary = q.contractType === "temporary";
  const contractBadgeClass = isPermanent
    ? "text-emerald-800 bg-emerald-50 border-emerald-200"
    : "text-amber-800 bg-amber-50 border-amber-200";
  const contractBadgeLabel = isPermanent
    ? t("permanentCdi")
    : isTemporary
      ? t("temporaryCdd")
      : null;

  const inputBase =
    "h-14 w-36 px-3.5 text-center font-bold text-2xl tabular-nums text-[var(--cam-text)] bg-white border-2 rounded-[6px] outline-none transition-colors focus:border-[var(--cam-green)] focus:shadow-[0_0_0_3px_rgba(30,107,58,0.15)]";
  const inputBorder = (bad: boolean) =>
    bad ? "border-[var(--cam-error)]" : "border-[var(--cam-border-strong)]";

  return (
    <div
      ref={containerRef}
      id={`guided-table-${definition.id}`}
      className={`w-full flex flex-col gap-5 font-sans max-w-[760px] scroll-mt-24 ${className}`}
      data-testid={`guided-table-${definition.id}`}
    >
      {/* ── Progress ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-1.5 bg-[var(--cam-border)] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
        >
          <div
            className="h-full bg-[var(--cam-green)] transition-all duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-[var(--cam-text-muted)] whitespace-nowrap">
          {t("questionOf", { current: safeIdx + 1, total: questions.length })}
        </span>
      </div>

      <div
        id={`guided-q-${definition.id}-${q.id}`}
        className="flex flex-col gap-5 bg-white border border-[var(--cam-border)] rounded-[8px] p-5 sm:p-7"
      >
        {/* ── Context: group being asked about ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[6px] bg-[var(--cam-surface-subtle)] border border-[var(--cam-border-subtle)]">
          <div className="text-[15px] font-bold text-[var(--cam-text)]">
            {q.categoryTag || q.rowLabel}
            {q.dimensionTag && <span className="font-semibold"> · {q.dimensionTag}</span>}
          </div>
          <div className="flex items-center gap-3">
            {contractBadgeLabel && (
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-[3px] border ${contractBadgeClass}`}>
                {contractBadgeLabel}
              </span>
            )}
            {hasAnyVal && (
              <button
                type="button"
                onClick={() => handleClearQuestion(q)}
                disabled={disabled}
                className="text-xs font-medium text-[var(--cam-error)] hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                {t("clear")}
              </button>
            )}
          </div>
        </div>

        {/* ── Question ── */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg sm:text-[21px] font-bold text-[var(--cam-text)] leading-snug tracking-tight m-0">
            {q.prompt}
          </h3>
          <p className="text-xs text-[var(--cam-text-muted)] m-0">
            {q.textField
              ? t("fewerThanThree")
              : t("zeroIsValid")}
          </p>
        </div>

        {/* ── Free-text reason / domain (bound to the AST text field) ── */}
        {q.textField && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`${baseId}_text_${q.id}`}
              className="text-xs font-bold text-[var(--cam-text-muted)]"
            >
              {q.textField.label}
            </label>
            <input
              id={`${baseId}_text_${q.id}`}
              type="text"
              autoComplete="off"
              disabled={disabled}
              placeholder={q.textField.placeholder}
              value={String(data[q.textField.fieldKey] ?? "")}
              onChange={(e) => {
                setError(null);
                onChange(q.textField!.fieldKey, e.target.value);
              }}
              onKeyDown={handleKeyDown}
              className="h-11 w-full max-w-[520px] px-3 text-[15px] text-[var(--cam-text)] bg-white border border-[var(--cam-border-strong)] rounded-[6px] outline-none focus:border-[var(--cam-green)] focus:shadow-[0_0_0_3px_rgba(30,107,58,0.15)]"
            />
          </div>
        )}

        {/* ── Total ── */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${baseId}_total_${q.id}`}
            className="text-xs font-bold text-[var(--cam-text-muted)]"
          >
            {t("totalNumber")}
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              id={`${baseId}_total_${q.id}`}
              data-guided-primary=""
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              placeholder="–"
              value={displayTotal}
              aria-invalid={Boolean(error) && displayTotal === ""}
              onChange={(e) => handleTargetTotalChange(q, e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.target.select()}
              className={`${inputBase} ${inputBorder(Boolean(error) && displayTotal === "")}`}
            />
            <span className="text-sm text-[var(--cam-text-muted)]">{t("persons")}</span>
          </div>
          {(targetNum === null || targetNum === 0) && (
            <div className="flex items-center gap-2.5 flex-wrap mt-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleTargetTotalChange(q, "0")}
                className="px-3.5 py-2 text-[13px] font-semibold bg-white border border-dashed border-[var(--cam-border-strong)] text-[var(--cam-text)] rounded-[4px] hover:border-[var(--cam-green)] hover:text-[var(--cam-green)] cursor-pointer"
              >
                {t("none0")}
              </button>
              {targetNum === 0 && (
                <span className="text-xs font-semibold text-[var(--cam-green)]">
                  {t("declaredZero")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Women / men split (other gender deduced) ── */}
        {hasMultipleBreakdowns && targetNum !== null && targetNum > 0 && isGenderSplit && (
          <div className="pl-4 sm:pl-5 border-l-2 border-[var(--cam-border-subtle)] flex flex-col gap-2.5">
            <label
              htmlFor={`${baseId}_${q.id}_split`}
              className="text-sm sm:text-base font-semibold text-[var(--cam-text)]"
            >
              {firstGender === "female"
                ? t("howManyWomen")
                : t("howManyMen")}
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                id={`${baseId}_${q.id}_split`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={disabled}
                placeholder="–"
                value={splitShown}
                aria-invalid={Boolean(error)}
                onChange={(e) => handleGenderSplitChange(q, firstGender, e.target.value, targetNum)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                className={`${inputBase} !w-28 ${inputBorder(Boolean(error) && displayTotal !== "")}`}
              />
              <span className="text-sm text-[var(--cam-text-muted)]">
                {firstGender === "female" ? t("women") : t("men")}
              </span>
              {deduced !== null && (
                <span className="inline-flex items-center gap-2 text-[13px] px-3 py-2 rounded-[6px] bg-[var(--cam-success-bg)] border border-[var(--cam-success-border)] text-[var(--cam-text)]">
                  <b className="text-lg text-[var(--cam-green)]">{deduced}</b>
                  {firstGender === "female"
                    ? t("menDeduced")
                    : t("womenDeduced")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setPreferredFirstGender((prev) => ({ ...prev, [q.id]: firstGender === "female" ? "male" : "female" }));
                setSplitDrafts((prev) => {
                  const next = { ...prev };
                  delete next[q.id];
                  return next;
                });
                setError(null);
              }}
              className="self-start text-[11px] font-semibold text-[var(--cam-text-muted)] hover:text-[var(--cam-green)] underline cursor-pointer bg-transparent border-none p-0"
            >
              {firstGender === "female"
                ? t("enterMenFirst")
                : t("enterWomenFirst")}
            </button>
          </div>
        )}

        {/* ── Multi-breakdown (>2 categories) ── */}
        {hasMultipleBreakdowns && targetNum !== null && targetNum > 0 && !isGenderSplit && (() => {
          const sum = qBreakdowns.reduce((acc, b) => acc + (b.value ?? 0), 0);
          return (
            <div className="pl-4 sm:pl-5 border-l-2 border-[var(--cam-border-subtle)] flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--cam-text)] m-0">{q.subPrompt}</p>
                {sum === targetNum ? (
                  <span className="text-xs font-bold text-[var(--cam-green)]">
                    {t("totalReached", { sum })}
                  </span>
                ) : sum < targetNum ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--cam-warning)]">
                      {t("remainingToDistribute", { count: targetNum - sum })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAutoFillRemainder(q, targetNum, sum)}
                      className="px-2 py-0.5 rounded-[3px] text-xs font-bold bg-white text-[var(--cam-green)] border border-[var(--cam-green)] hover:bg-[var(--cam-success-bg)] cursor-pointer"
                    >
                      {t("fillRest")}
                    </button>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-[var(--cam-error)]">
                    {t("exceedsBy", { count: sum - targetNum })}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {qBreakdowns.map((b) => {
                  const inputId = `${baseId}_${q.id}_${b.fieldKey}`;
                  return (
                    <div key={b.fieldKey} className="flex items-center justify-between max-w-sm gap-4">
                      <label htmlFor={inputId} className="text-sm font-medium text-[var(--cam-text)]">
                        {b.label}
                      </label>
                      <input
                        id={inputId}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={disabled}
                        value={b.value != null ? String(b.value) : ""}
                        placeholder="0"
                        onChange={(e) => handleGeneralBreakdownChange(q, b.fieldKey, e.target.value.replace(/\D/g, ""))}
                        onKeyDown={handleKeyDown}
                        onFocus={(e) => e.target.select()}
                        className="w-20 h-10 px-2.5 text-center font-bold text-lg tabular-nums text-[var(--cam-text)] bg-white border border-[var(--cam-border-strong)] rounded-[4px] outline-none focus:border-[var(--cam-green)]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {error && (
          <div
            role="alert"
            className="text-[13px] font-semibold px-3.5 py-2.5 rounded-[6px] border bg-[var(--cam-error-bg)] border-[var(--cam-error-border)] text-[var(--cam-error)]"
          >
            {error}
          </div>
        )}

        <p className="text-[11px] text-[var(--cam-text-muted)] m-0 hidden sm:block">
          {t("pressEnter")}
        </p>
      </div>
    </div>
  );
}
