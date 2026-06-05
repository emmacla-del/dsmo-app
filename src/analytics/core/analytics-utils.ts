// analytics/core/analytics-utils.ts

import { DepartureType } from './analytics-enums';
import type { SkillNeedRow, TrainingNeedRow, SkillGapItem, TrainingGapResult } from './analytics-types';

// ─────────────────────────────────────────────────────────────
// NUMERIC HELPERS
// ─────────────────────────────────────────────────────────────

export function calculateRate(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return +((numerator / denominator) * 100).toFixed(1);
}

/**
 * Weighted midpoint average across three age bands.
 * Midpoints: 15-24 → 20, 25-34 → 30, 35+ → 45
 */
export function computeAverageAge(
    age15_24: number,
    age25_34: number,
    age35Plus: number,
): number {
    const total = age15_24 + age25_34 + age35Plus;
    if (total === 0) return 0;
    return +((age15_24 * 20 + age25_34 * 30 + age35Plus * 45) / total).toFixed(1);
}

export function computeFemaleLeadershipRate(femaleCadres: number, totalCadres: number): number {
    return calculateRate(femaleCadres, totalCadres);
}

// ─────────────────────────────────────────────────────────────
// DEPARTURE CLASSIFICATION
// ─────────────────────────────────────────────────────────────

export function classifyDepartureType(type: string): DepartureType {
    const upper = type?.toUpperCase() ?? '';
    if (upper.includes('DEMISSION') || upper.includes('RESIGNATION')) return DepartureType.RESIGNATION;
    if (upper.includes('LICENCIEMENT') || upper.includes('DISMISSAL')) return DepartureType.DISMISSAL;
    if (upper.includes('RETRAITE') || upper.includes('RETIREMENT')) return DepartureType.RETIREMENT;
    return DepartureType.OTHER;
}

// ─────────────────────────────────────────────────────────────
// MOBILITY RATES
// ─────────────────────────────────────────────────────────────

export interface MobilityRates {
    resignationRate: number;
    dismissalRate: number;
    retirementRate: number;
    turnoverRate: number;
    retentionRate: number;
}

export function computeMobilityRates(
    totalEmployees: number,
    totalDepartures: number,
    resignations: number,
    dismissals: number,
    retirements: number,
): MobilityRates {
    return {
        resignationRate: calculateRate(resignations, totalEmployees),
        dismissalRate: calculateRate(dismissals, totalEmployees),
        retirementRate: calculateRate(retirements, totalEmployees),
        turnoverRate: calculateRate(totalDepartures, totalEmployees),
        retentionRate: Math.max(0, calculateRate(totalEmployees - totalDepartures, totalEmployees)),
    };
}

// ─────────────────────────────────────────────────────────────
// SKILL / TRAINING GAP
// ─────────────────────────────────────────────────────────────

export function computeTrainingGap(
    skillNeeds: SkillNeedRow[],
    trainingNeeds: TrainingNeedRow[],
): TrainingGapResult {
    const demandMap = new Map(skillNeeds.map((s) => [s.skill, s.totalCount]));
    const supplyMap = new Map(trainingNeeds.map((t) => [t.domain, t.totalCount]));
    const allKeys = new Set([...demandMap.keys(), ...supplyMap.keys()]);

    const gaps: SkillGapItem[] = Array.from(allKeys)
        .map((key) => ({
            skill: key,
            demand: demandMap.get(key) ?? 0,
            supply: supplyMap.get(key) ?? 0,
            gap: (demandMap.get(key) ?? 0) - (supplyMap.get(key) ?? 0),
        }))
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    return {
        skillsInDemand: gaps.filter((g) => g.gap > 0).slice(0, 10),
        skillsInSurplus: gaps.filter((g) => g.gap < 0).slice(0, 10),
        balanced: gaps.filter((g) => g.gap === 0),
    };
}