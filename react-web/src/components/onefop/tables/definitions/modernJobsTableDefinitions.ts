// src/components/onefop/tables/definitions/modernJobsTableDefinitions.ts

import { tableHasStatusDimension, type FormData, type OnefopField } from "@/lib/onefop-schema";
import {
  AGE_BAND_LABELS,
  DEPARTURE_TYPE_LABELS,
  DIPLOMA_ROW_KEYS,
  DIPLOMA_ROW_LABELS,
  DISMISSAL_TYPE_LABELS,
  EMBEDDED_ROW_TEXT,
  GENDER_LABELS,
  INTERNSHIP_ROW_KEYS,
  INTERNSHIP_ROW_LABELS,
  MFT_LABELS,
  SEX_COLUMN_LABELS,
  REASONS_ROW_KEYS,
  REASONS_ROW_LABELS,
  SKILLS_ROW_KEYS,
  SKILLS_ROW_LABELS,
  STATUS_GENDER_GROUP_LABELS,
  TRAINING_ROW_KEYS,
  TRAINING_ROW_LABELS,
  VULNERABLE_ROW_KEYS,
  VULNERABLE_ROW_LABELS,
  embeddedRowTextFieldId,
  rowLabel,
} from "@/lib/onefop-tables";
import {
  genderAgeRow,
  isComputedCspCell,
  recalculateCspGenderAge,
  recalculateCspStatusGender,
  recalculateDeparture,
  recalculateDismissalUnemployment,
  recalculateFirstTimeWorkers,
  recalculateGenderOnly,
  statusGenderRow,
  typeGenderRow,
} from "@/lib/onefop-formulas";
import type {
  CalculationFunction,
  FixedMatrixDefinition,
  StatisticalCellDefinition,
  StatisticalColumnDefinition,
  StatisticalRowDefinition,
} from "../StatisticalTableDefinition";
import { applyQuizRequired } from "../quizRequired";

/**
 * Resolves active age bands, active CSP rows, and raw age scope for a table
 * based on the questionnaire interview answers in `data._scopeConfig`, falling back
 * to global `data._scopeAge` / `data._scopeCsp`.
 */
export function resolveTableScope(
  field: OnefopField,
  data?: FormData,
  defaultCspRows: string[] = ["cadres", "foremen", "workers"],
): {
  activeAgeIndices: number[];
  cspRows: string[];
  rawAgeScope: string[] | null;
} {
  const tid = (field.table?.id ?? field.id ?? "").toLowerCase();
  const scopeConfig = data?._scopeConfig as Record<string, any> | undefined;

  let targetAges: string[] | null = null;
  let targetCsps: string[] | null = null;

  // Administration's S21Q01 is a staff census, not job applications: no quiz
  // question governs it, so it is never narrowed by quiz answers.
  if (tid.includes("s21q01") && defaultCspRows.includes("fonctionnaire")) {
    return { activeAgeIndices: [0, 1, 2, 3], cspRows: defaultCspRows, rawAgeScope: null };
  }

  if (scopeConfig) {
    if (tid.includes("s21q01") || tid.includes("pp_s4q01")) {
      // Demandes d'emploi reçues
      if (scopeConfig.applications) {
        targetAges = Array.isArray(scopeConfig.application_age) && scopeConfig.application_age.length > 0
          ? scopeConfig.application_age
          : null;
        targetCsps = Array.isArray(scopeConfig.application_csp) && scopeConfig.application_csp.length > 0
          ? scopeConfig.application_csp
          : null;
      }
    } else if (
      // Administration S21Q02–S21Q04 (recrutements, handicap, vulnérables)
      /s21q0[234]/.test(tid) ||
      tid.includes("s22q01") ||
      tid.includes("s22q02") ||
      tid.includes("s22q03") ||
      tid.includes("s22q04") ||
      tid.includes("s22q05") ||
      tid.includes("pp_s4q02") ||
      tid.includes("pp_s4q03")
    ) {
      // Recrutements (permanent, temporaire, diplôme, handicap, vulnérable)
      if (scopeConfig.recruit) {
        targetAges = Array.isArray(scopeConfig.recruit_age) && scopeConfig.recruit_age.length > 0
          ? scopeConfig.recruit_age
          : null;
        targetCsps = Array.isArray(scopeConfig.recruit_csp) && scopeConfig.recruit_csp.length > 0
          ? scopeConfig.recruit_csp
          : null;
      }
    } else if (tid.includes("s23q01") || tid.includes("pp_s4q04")) {
      // Primo-demandeurs
      if (scopeConfig.primo_seekers) {
        targetAges = Array.isArray(scopeConfig.primo_seekers_age) && scopeConfig.primo_seekers_age.length > 0
          ? scopeConfig.primo_seekers_age
          : null;
        targetCsps = Array.isArray(scopeConfig.primo_seekers_csp) && scopeConfig.primo_seekers_csp.length > 0
          ? scopeConfig.primo_seekers_csp
          : null;
      }
    } else if (tid.includes("s23q02")) {
      // Primo-insérés
      if (scopeConfig.primo_workers) {
        targetAges = Array.isArray(scopeConfig.primo_workers_age) && scopeConfig.primo_workers_age.length > 0
          ? scopeConfig.primo_workers_age
          : null;
        targetCsps = Array.isArray(scopeConfig.primo_workers_csp) && scopeConfig.primo_workers_csp.length > 0
          ? scopeConfig.primo_workers_csp
          : null;
      }
    }
  }

  // Fallback to global _scopeAge / _scopeCsp if table-specific scope was not found
  if (!targetAges && Array.isArray(data?._scopeAge) && data._scopeAge.length > 0) {
    targetAges = data._scopeAge as string[];
  }
  if (!targetCsps && Array.isArray(data?._scopeCsp) && data._scopeCsp.length > 0) {
    targetCsps = data._scopeCsp as string[];
  }

  // Filter age columns (0: 15-24, 1: 25-34, 2: 35+, 3: Total)
  const activeAgeIndices = targetAges && targetAges.length > 0
    ? [0, 1, 2]
        .filter((i) => {
          const code = i === 0 ? "15_24" : i === 1 ? "25_34" : "35_plus";
          return targetAges!.includes(code);
        })
        .concat([3])
    : [0, 1, 2, 3];

  // Filter CSP rows according to targetCsps
  let cspRows = defaultCspRows;
  if (targetCsps && targetCsps.length > 0) {
    const normalized = targetCsps.map((k) =>
      k === "maitrise" ? "foremen" : k === "execution" ? "workers" : k
    );
    const filtered = defaultCspRows.filter((r) => normalized.includes(r));
    if (filtered.length > 0) {
      cspRows = filtered;
    }
  }

  return { activeAgeIndices, cspRows, rawAgeScope: targetAges };
}

/**
 * Builds an AdaptiveStatisticalTable definition for S21Q01: Recrutements par CSP × Sexe × Tranches d'âge.
 * 12 columns grouped by Age Band with M/F/Total sub-columns, plus automatic Grand Total row.
 */
export function buildModernJobsRecruitmentTableDefinition(
  field: OnefopField,
  data?: FormData,
): FixedMatrixDefinition {
  const table = field.table;
  const defaultCspRows = table?.rowKeys && table.rowKeys.length > 0 ? table.rowKeys : ["cadres", "foremen", "workers"];
  const { activeAgeIndices, cspRows } = resolveTableScope(field, data, defaultCspRows);
  const tableId = table?.id ?? "s21q01";

  const columns: StatisticalColumnDefinition[] = [];
  const headerGroups = GENDER_LABELS.map((g) => ({
    title: g,
    colSpan: activeAgeIndices.length,
  }));

  GENDER_LABELS.forEach((g, gIdx) => {
    activeAgeIndices.forEach((aIdx) => {
      const a = AGE_BAND_LABELS[aIdx];
      const colKey = `c_${gIdx}_${aIdx}`;
      const isColTotal = aIdx === AGE_BAND_LABELS.length - 1 || gIdx === GENDER_LABELS.length - 1;
      columns.push({
        key: colKey,
        header: a,
        kind: isColTotal ? "computed" : "number",
        align: "right",
        width: 95,
        group: g,
      });
    });
  });

  // Build rows: only active CSP rows and active age bands
  const rows: StatisticalRowDefinition[] = cspRows.map((rKey) => {
    const allCellIds = genderAgeRow(tableId, rKey);
    const cells: Record<string, StatisticalCellDefinition> = {};

    let colIndex = 0;
    GENDER_LABELS.forEach((_g, gIdx) => {
      activeAgeIndices.forEach((aIdx) => {
        const canonicalIndex = gIdx * 4 + aIdx;
        const cellId = allCellIds[canonicalIndex];
        const colDef = columns[colIndex++];
        const isComputed = isComputedCspCell(cellId);
        cells[colDef.key] = {
          key: colDef.key,
          fieldKey: cellId,
          kind: isComputed ? "computed" : "number",
          min: 0,
        };
      });
    });

    return {
      id: rKey,
      label: rowLabel(rKey),
      cells,
    };
  });

  // Total row: only active age bands
  const totalAllCellIds = genderAgeRow(tableId, "total");
  const totalCells: Record<string, StatisticalCellDefinition> = {};
  let totalColIndex = 0;
  GENDER_LABELS.forEach((_g, gIdx) => {
    activeAgeIndices.forEach((aIdx) => {
      const canonicalIndex = gIdx * 4 + aIdx;
      const cellId = totalAllCellIds[canonicalIndex];
      const colDef = columns[totalColIndex++];
      totalCells[colDef.key] = {
        key: colDef.key,
        fieldKey: cellId,
        kind: "computed",
      };
    });
  });

  rows.push({
    id: "total",
    label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    isTotal: true,
    cells: totalCells,
  });

  return {
    id: tableId,
    paperCode: field.paperCode ?? "S2.1",
    title: field.label ?? {
      fr: "Recrutements selon la catégorie socio-professionnelle, le sexe et la tranche d'âge",
      en: "Recruitments by occupational category, sex, and age group",
    },
    caption: {
      fr: "Répartition des recrutements effectués au cours du trimestre",
      en: "Distribution of recruitments carried out during the quarter",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Catégorie Socio-Professionnelle",
      en: "Occupational Category",
    },
    headerGroups,
    columns,
    rows,
    hasTotalRow: true,
    totalRowLabel: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    defaultMobileView: "guided",
    calculationMode: "materialized",
    adaptive: {
      gridSuitable: true,
      guidedSuitable: true,
      allowUserToggle: true,
      desktopMode: "grid",
      mobileMode: "guided",
      preferredMode: "grid",
    },
    rawRows: cspRows,
    recalc: recalculateCspGenderAge,
  };
}

/**
 * Builds an AdaptiveStatisticalTable definition for S4Q01: Stages par type × Sexe.
 * 4 internship type rows + 1 total row × 3 columns (M, F, Total) = 15 cells.
 * Used as structural proof for simple 2D tables in Phase 4.
 */
export function buildModernJobsInternshipTableDefinition(
  field: OnefopField,
  data?: FormData,
): FixedMatrixDefinition {
  const table = field.table;
  const tableId = table?.id ?? "s4q01";

  const scopeConfig = data?._scopeConfig as Record<string, any> | undefined;
  const internTypes = scopeConfig?.intern_types as string[] | undefined;
  const internMap: Record<string, string> = {
    vacance: "vacation",
    academique: "academic",
    professionnel: "professional",
    preemploi: "pre_employment",
  };
  const activeInternKeys = Array.isArray(internTypes) && internTypes.length > 0
    ? INTERNSHIP_ROW_KEYS.filter((k) => internTypes.some((t) => internMap[t] === k))
    : INTERNSHIP_ROW_KEYS;
  const rows = activeInternKeys.length > 0 ? activeInternKeys : INTERNSHIP_ROW_KEYS;

  const columns: StatisticalColumnDefinition[] = [
    {
      key: "male",
      header: SEX_COLUMN_LABELS.male,
      kind: "number",
      align: "right",
      width: 130,
    },
    {
      key: "female",
      header: SEX_COLUMN_LABELS.female,
      kind: "number",
      align: "right",
      width: 130,
    },
    {
      key: "total",
      header: SEX_COLUMN_LABELS.total,
      kind: "computed",
      align: "right",
      width: 130,
    },
  ];

  const rowDefs: StatisticalRowDefinition[] = rows.map((rKey) => {
    const origIdx = INTERNSHIP_ROW_KEYS.indexOf(rKey);
    const label = INTERNSHIP_ROW_LABELS[origIdx] ?? { fr: rKey, en: rKey };
    return {
      id: rKey,
      label,
      cells: {
        male: {
          key: "male",
          fieldKey: `${tableId}_${rKey}_male`,
          kind: "number",
          min: 0,
        },
        female: {
          key: "female",
          fieldKey: `${tableId}_${rKey}_female`,
          kind: "number",
          min: 0,
        },
        total: {
          key: "total",
          fieldKey: `${tableId}_${rKey}_total`,
          kind: "computed",
        },
      },
    };
  });

  // Total row
  rowDefs.push({
    id: "total",
    label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    isTotal: true,
    cells: {
      male: {
        key: "male",
        fieldKey: `${tableId}_total_male`,
        kind: "computed",
      },
      female: {
        key: "female",
        fieldKey: `${tableId}_total_female`,
        kind: "computed",
      },
      total: {
        key: "total",
        fieldKey: `${tableId}_total_total`,
        kind: "computed",
      },
    },
  });

  return {
    id: tableId,
    paperCode: field.paperCode ?? "S4.1",
    title: field.label ?? {
      fr: "Stagiaires accueillis selon le type de stage et le sexe",
      en: "Interns hosted by internship type and sex",
    },
    caption: {
      fr: "Répartition des stagiaires accueillis au cours de la période",
      en: "Distribution of interns hosted during the period",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Type de stage",
      en: "Internship Type",
    },
    columns,
    rows: rowDefs,
    hasTotalRow: true,
    totalRowLabel: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    defaultMobileView: "guided",
    calculationMode: "materialized",
    adaptive: {
      gridSuitable: true,
      guidedSuitable: true,
      allowUserToggle: true,
      desktopMode: "grid",
      mobileMode: "grid",
      preferredMode: "grid",
    },
    rawRows: [...rows],
    recalc: recalculateGenderOnly,
  };
}

/**
 * Builds an AdaptiveStatisticalTable definition for S3Q01: Départs par motif × Sexe.
 * 15 columns (5 departure motives × 3 M/F/Total columns).
 */
export function buildModernJobsDepartureTableDefinition(
  field: OnefopField,
  data?: FormData,
): FixedMatrixDefinition {
  const table = field.table;
  const defaultCspRows = table?.rowKeys && table.rowKeys.length > 0 ? table.rowKeys : ["cadres", "foremen", "workers"];
  const { cspRows } = resolveTableScope(field, data, defaultCspRows);
  const tableId = table?.id ?? "s3q01";

  const scopeConfig = data?._scopeConfig as Record<string, any> | undefined;
  const reasons = scopeConfig?.departure_reasons as string[] | undefined;
  const reasonMap: Record<string, string> = {
    licenciement: "dismissal",
    demission: "resignation",
    retraite: "retirement",
    autre: "other",
  };
  const allDepartureTypes = ["dismissal", "resignation", "retirement", "other", "ensemble"];
  const departureTypes = Array.isArray(reasons) && reasons.length > 0
    ? allDepartureTypes.filter((t) => t === "ensemble" || reasons.some((r) => reasonMap[r] === t))
    : allDepartureTypes;

  const columns: StatisticalColumnDefinition[] = [];
  const headerGroups = departureTypes.map((dt) => {
    const origIdx = allDepartureTypes.indexOf(dt);
    return {
      title: DEPARTURE_TYPE_LABELS[origIdx],
      colSpan: MFT_LABELS.length,
    };
  });

  departureTypes.forEach((dt, dtIdx) => {
    const origIdx = allDepartureTypes.indexOf(dt);
    const origGroupLabel = DEPARTURE_TYPE_LABELS[origIdx];
    MFT_LABELS.forEach((mft, mIdx) => {
      const colKey = `c_${dtIdx}_${mIdx}`;
      const isColTotal = mIdx === MFT_LABELS.length - 1 || dt === "ensemble";
      columns.push({
        key: colKey,
        header: mft,
        kind: isColTotal ? "computed" : "number",
        align: "right",
        width: 85,
        group: origGroupLabel,
      });
    });
  });

  const rows: StatisticalRowDefinition[] = cspRows.map((rKey) => {
    const cellIds = typeGenderRow(tableId, rKey, departureTypes);
    const cells: Record<string, StatisticalCellDefinition> = {};

    cellIds.forEach((cellId, cIdx) => {
      const colDef = columns[cIdx];
      const isComputed = isComputedCspCell(cellId);
      cells[colDef.key] = {
        key: colDef.key,
        fieldKey: cellId,
        kind: isComputed ? "computed" : "number",
        min: 0,
      };
    });

    return {
      id: rKey,
      label: rowLabel(rKey),
      cells,
    };
  });

  // Total row
  const totalCellIds = typeGenderRow(tableId, "total", departureTypes);
  const totalCells: Record<string, StatisticalCellDefinition> = {};
  totalCellIds.forEach((cellId, cIdx) => {
    const colDef = columns[cIdx];
    totalCells[colDef.key] = {
      key: colDef.key,
      fieldKey: cellId,
      kind: "computed",
    };
  });

  rows.push({
    id: "total",
    label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    isTotal: true,
    cells: totalCells,
  });

  return {
    id: tableId,
    paperCode: field.paperCode ?? "S3.1",
    title: field.label ?? {
      fr: "Départs de personnel selon le motif et le sexe",
      en: "Staff departures by motive and sex",
    },
    caption: {
      fr: "Décomposition des départs enregistrés au cours du trimestre",
      en: "Breakdown of departures recorded during the quarter",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Catégorie Socio-Professionnelle",
      en: "Occupational Category",
    },
    headerGroups,
    columns,
    rows,
    hasTotalRow: true,
    totalRowLabel: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    defaultMobileView: "guided",
    calculationMode: "materialized",
    adaptive: {
      gridSuitable: true,
      guidedSuitable: true,
      allowUserToggle: true,
      desktopMode: "grid",
      mobileMode: "guided",
      preferredMode: "grid",
    },
    rawRows: cspRows,
    recalc: recalculateDeparture,
  };
}

/**
 * Builds an AdaptiveStatisticalTable definition for S22Q03: Recrutements par diplôme / niveau d'instruction.
 * 12 diploma rows × Age/Gender bands.
 */
export function buildModernJobsDiplomaTableDefinition(
  field: OnefopField,
  data?: FormData,
  requestedCsp?: string,
): FixedMatrixDefinition {
  const table = field.table;
  const tableId = table?.id ?? "s22q03";
  const defaultCsps = table?.csps && table.csps.length > 0 ? table.csps : ["cadres", "foremen", "workers"];

  // Sex columns (M, F, Total) always render unconditionally.
  // Age columns and CSP categories filter to selected scope if active in prefilling.
  const { activeAgeIndices, cspRows } = resolveTableScope(field, data, defaultCsps);
  const activeCsp = requestedCsp && cspRows.includes(requestedCsp) ? requestedCsp : (cspRows[0] ?? "cadres");

  const columns: StatisticalColumnDefinition[] = [];
  const headerGroups = GENDER_LABELS.map((g) => ({
    title: g,
    colSpan: activeAgeIndices.length,
  }));

  GENDER_LABELS.forEach((g, gIdx) => {
    activeAgeIndices.forEach((aIdx) => {
      const a = AGE_BAND_LABELS[aIdx];
      const colKey = `c_${gIdx}_${aIdx}`;
      const isColTotal = aIdx === AGE_BAND_LABELS.length - 1 || gIdx === GENDER_LABELS.length - 1;
      columns.push({
        key: colKey,
        header: a,
        kind: isColTotal ? "computed" : "number",
        align: "right",
        width: 95,
        group: g,
      });
    });
  });

  const scopedDiplomas = (data?._scopeConfig as { recruit_diploma?: string[] } | undefined)?.recruit_diploma;
  const activeDiplomaKeys = Array.isArray(scopedDiplomas) && scopedDiplomas.length > 0
    ? DIPLOMA_ROW_KEYS.filter((k) => scopedDiplomas.includes(k))
    : DIPLOMA_ROW_KEYS;

  const buildRowsForCsp = (csp: string): StatisticalRowDefinition[] => {
    const cspPrefix = `${tableId}_${csp}`;
    const rows: StatisticalRowDefinition[] = activeDiplomaKeys.map((dKey) => {
      const origIdx = DIPLOMA_ROW_KEYS.indexOf(dKey);
      const allCellIds = genderAgeRow(cspPrefix, dKey);
      const cells: Record<string, StatisticalCellDefinition> = {};

      let colIndex = 0;
      GENDER_LABELS.forEach((_g, gIdx) => {
        activeAgeIndices.forEach((aIdx) => {
          const canonicalIndex = gIdx * 4 + aIdx;
          const cellId = allCellIds[canonicalIndex];
          const colDef = columns[colIndex++];
          const isComputed = isComputedCspCell(cellId);
          cells[colDef.key] = {
            key: colDef.key,
            fieldKey: cellId,
            kind: isComputed ? "computed" : "number",
            min: 0,
          };
        });
      });

      return {
        id: dKey,
        label: DIPLOMA_ROW_LABELS[origIdx] ?? { fr: dKey, en: dKey },
        cells,
      };
    });

    // Total row: only active age bands for this CSP
    const totalAllCellIds = genderAgeRow(cspPrefix, "total");
    const totalCells: Record<string, StatisticalCellDefinition> = {};
    let totalColIndex = 0;
    GENDER_LABELS.forEach((_g, gIdx) => {
      activeAgeIndices.forEach((aIdx) => {
        const canonicalIndex = gIdx * 4 + aIdx;
        const cellId = totalAllCellIds[canonicalIndex];
        const colDef = columns[totalColIndex++];
        totalCells[colDef.key] = {
          key: colDef.key,
          fieldKey: cellId,
          kind: "computed",
        };
      });
    });

    rows.push({
      id: "total",
      label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
      isTotal: true,
      cells: totalCells,
    });

    return rows;
  };

  const recalcForCsp = (csp: string): CalculationFunction => {
    return (currentData: Record<string, number>, _prefix: string, _rows: string[]) =>
      recalculateCspGenderAge(currentData, `${tableId}_${csp}`, activeDiplomaKeys);
  };

  const rows = buildRowsForCsp(activeCsp);

  return {
    id: tableId,
    paperCode: field.paperCode ?? "S2.2.3",
    title: field.label ?? {
      fr: "Recrutements selon le diplôme le plus élevé et le sexe",
      en: "Recruitments by highest qualification and sex",
    },
    caption: {
      fr: "Répartition selon les 12 niveaux académiques et professionnels officiels",
      en: "Distribution according to the 12 official academic and vocational levels",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Diplôme / Niveau d'instruction",
      en: "Diploma / Educational Level",
    },
    headerGroups,
    columns,
    rows,
    hasTotalRow: true,
    totalRowLabel: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    defaultMobileView: "guided",
    calculationMode: "materialized",
    adaptive: {
      gridSuitable: true,
      guidedSuitable: true,
      allowUserToggle: true,
      desktopMode: "grid",
      mobileMode: "guided",
      preferredMode: "grid",
    },
    rawRows: activeDiplomaKeys,
    recalc: recalcForCsp(activeCsp),
    cspSlices: cspRows,
    activeCsp,
    buildRowsForCsp,
    recalcForCsp,
  };
}

/**
 * Builds an AdaptiveStatisticalTable definition for S22Q04: Recrutements de personnes en situation de handicap par CSP × Statut × Sexe.
 * 9 columns (3 status groups: Permanent, Temporaire, Total × 3 M/F/Total columns), plus automatic Grand Total row = 36 cells.
 * Used as the structurally different second-family pilot in Phase 15.
 */
export function buildModernJobsCspStatusGenderTableDefinition(
  field: OnefopField,
  data?: FormData,
): FixedMatrixDefinition {
  const table = field.table;
  const defaultCspRows = table?.rowKeys && table.rowKeys.length > 0 ? table.rowKeys : ["cadres", "foremen", "workers"];
  const { cspRows } = resolveTableScope(field, data, defaultCspRows);
  const tableId = table?.id ?? "s22q04";
  if (!tableHasStatusDimension(table)) {
    return buildCategoryGenderDefinition(field, tableId, cspRows);
  }

  // Build columns (3 status groups * 3 sub-columns = 9 columns)
  const columns: StatisticalColumnDefinition[] = [];
  const headerGroups = STATUS_GENDER_GROUP_LABELS.map((s) => ({
    title: s,
    colSpan: MFT_LABELS.length,
  }));

  STATUS_GENDER_GROUP_LABELS.forEach((s, sIdx) => {
    MFT_LABELS.forEach((mft, mIdx) => {
      const colKey = `c_${sIdx}_${mIdx}`;
      const isColTotal = mIdx === MFT_LABELS.length - 1 || sIdx === STATUS_GENDER_GROUP_LABELS.length - 1;
      columns.push({
        key: colKey,
        header: mft,
        kind: isColTotal ? "computed" : "number",
        align: "right",
        width: 95,
        group: s,
      });
    });
  });

  // Build rows
  const rows: StatisticalRowDefinition[] = cspRows.map((rKey) => {
    const cellIds = statusGenderRow(tableId, rKey);
    const cells: Record<string, StatisticalCellDefinition> = {};

    cellIds.forEach((cellId, cIdx) => {
      const colDef = columns[cIdx];
      const isComputed = isComputedCspCell(cellId);
      cells[colDef.key] = {
        key: colDef.key,
        fieldKey: cellId,
        kind: isComputed ? "computed" : "number",
        min: 0,
      };
    });

    return {
      id: rKey,
      label: rowLabel(rKey),
      cells,
    };
  });

  // Total row
  const totalCellIds = statusGenderRow(tableId, "total");
  const totalCells: Record<string, StatisticalCellDefinition> = {};
  totalCellIds.forEach((cellId, cIdx) => {
    const colDef = columns[cIdx];
    totalCells[colDef.key] = {
      key: colDef.key,
      fieldKey: cellId,
      kind: "computed",
    };
  });

  rows.push({
    id: "total",
    label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    isTotal: true,
    cells: totalCells,
  });

  return {
    id: tableId,
    paperCode: field.paperCode ?? "S22Q04",
    title: field.label ?? {
      fr: "Recrutements de personnes en situation de handicap selon la catégorie socio-professionnelle, le sexe et le statut",
      en: "Recruitments of persons with disabilities by occupational category, sex, and status",
    },
    caption: {
      fr: "Répartition selon le statut d'emploi (Permanent, Temporaire) et le sexe",
      en: "Distribution by employment status (Permanent, Temporary) and sex",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Catégorie Socio-Professionnelle",
      en: "Occupational Category",
    },
    headerGroups,
    columns,
    rows,
    hasTotalRow: true,
    totalRowLabel: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    defaultMobileView: "guided",
    calculationMode: "materialized",
    adaptive: {
      gridSuitable: true,
      guidedSuitable: true,
      allowUserToggle: true,
      desktopMode: "grid",
      mobileMode: "guided",
      preferredMode: "grid",
    },
    rawRows: cspRows,
    recalc: (data) => recalculateCspStatusGender(data, tableId, cspRows),
  };
}

/**
 * Builds an AdaptiveStatisticalTable definition for S23Q02: Primo-insérés par CSP × Statut d'emploi × Sexe × Tranches d'âge.
 */
export function buildModernJobsFirstTimeWorkersTableDefinition(
  field: OnefopField,
  data?: FormData,
): FixedMatrixDefinition {
  const table = field.table;
  const defaultCspRows = table?.rowKeys && table.rowKeys.length > 0 ? table.rowKeys : ["cadres", "foremen", "workers"];
  const tableId = table?.id ?? "s23q02";

  const { activeAgeIndices, cspRows } = resolveTableScope(field, data, defaultCspRows);

  const scopeConfig = data?._scopeConfig as Record<string, any> | undefined;
  const scopedTypes = scopeConfig?.primo_workers_types;
  const rawContracts = Array.isArray(scopedTypes) && scopedTypes.length > 0
    ? ["permanent", "temporary"].filter((c) => scopedTypes.includes(c === "temporary" ? "temporaire" : c))
    : ["permanent", "temporary"];
  const contracts = rawContracts.length > 0 ? rawContracts : ["permanent", "temporary"];

  const columns: StatisticalColumnDefinition[] = [];
  const headerGroups = GENDER_LABELS.map((g) => ({
    title: g,
    colSpan: activeAgeIndices.length,
  }));

  GENDER_LABELS.forEach((g, gIdx) => {
    activeAgeIndices.forEach((aIdx) => {
      const a = AGE_BAND_LABELS[aIdx];
      const colKey = `c_${gIdx}_${aIdx}`;
      const isColTotal = aIdx === AGE_BAND_LABELS.length - 1 || gIdx === GENDER_LABELS.length - 1;
      columns.push({
        key: colKey,
        header: a,
        kind: isColTotal ? "computed" : "number",
        align: "right",
        width: 95,
        group: g,
      });
    });
  });

  const rows: StatisticalRowDefinition[] = [];

  for (const contract of contracts) {
    const blockTitle = contract === "permanent" ? "Permanent" : "Temporaire";

    for (const rKey of cspRows) {
      const allCellIds = genderAgeRow(tableId, `${contract}_${rKey}`);
      const cells: Record<string, StatisticalCellDefinition> = {};

      let colIndex = 0;
      GENDER_LABELS.forEach((_g, gIdx) => {
        activeAgeIndices.forEach((aIdx) => {
          const canonicalIndex = gIdx * 4 + aIdx;
          const cellId = allCellIds[canonicalIndex];
          const colDef = columns[colIndex++];
          const isComputed = isComputedCspCell(cellId);
          cells[colDef.key] = {
            key: colDef.key,
            fieldKey: cellId,
            kind: isComputed ? "computed" : "number",
            min: 0,
          };
        });
      });

      const label = rowLabel(rKey);
      rows.push({
        id: `${contract}_${rKey}`,
        label: {
          fr: `${blockTitle} — ${label.fr}`,
          en: `${blockTitle} — ${label.en}`,
        },
        cells,
      });
    }

    // Subtotal row for contract block
    const subtotalAllCellIds = genderAgeRow(tableId, `${contract}_total`);
    const subtotalCells: Record<string, StatisticalCellDefinition> = {};
    let subColIndex = 0;
    GENDER_LABELS.forEach((_g, gIdx) => {
      activeAgeIndices.forEach((aIdx) => {
        const canonicalIndex = gIdx * 4 + aIdx;
        const cellId = subtotalAllCellIds[canonicalIndex];
        const colDef = columns[subColIndex++];
        subtotalCells[colDef.key] = {
          key: colDef.key,
          fieldKey: cellId,
          kind: "computed",
        };
      });
    });

    rows.push({
      id: `${contract}_total`,
      label: {
        fr: `Sous-total ${blockTitle}`,
        en: `Subtotal ${blockTitle}`,
      },
      isTotal: true,
      cells: subtotalCells,
    });
  }

  return {
    id: tableId,
    paperCode: field.paperCode ?? "S2.3.2",
    title: field.label ?? {
      fr: "Primo-insérés selon la CSP, le statut d'emploi, le sexe et la tranche d'âge",
      en: "First-time job entrants by occupational category, employment status, sex, and age group",
    },
    caption: {
      fr: "Répartition selon le statut d'emploi (Permanent, Temporaire) et le sexe",
      en: "Distribution by employment status (Permanent, Temporary) and sex",
    },
    type: "fixed-matrix",
    rowHeaderLabel: {
      fr: "Statut / Catégorie Socio-Professionnelle",
      en: "Status / Occupational Category",
    },
    headerGroups,
    columns,
    rows,
    hasTotalRow: false,
    defaultMobileView: "guided",
    calculationMode: "materialized",
    adaptive: {
      gridSuitable: true,
      guidedSuitable: true,
      allowUserToggle: true,
      desktopMode: "grid",
      mobileMode: "guided",
      preferredMode: "grid",
    },
    rawRows: cspRows,
    recalc: (data) => recalculateFirstTimeWorkers(data, tableId, cspRows),
  };
}

/**
 * Universal dispatcher that checks if a table field has a high-dimensional Adaptive definition.
 */
export function getModernJobsTableDefinition(
  field: OnefopField,
  data?: FormData,
): FixedMatrixDefinition | null {
  const template = field.table?.template;
  if (!template) return null;

  let built: FixedMatrixDefinition | null = null;
  if (template === "csp_gender_age_table") {
    built = buildModernJobsRecruitmentTableDefinition(field, data);
  } else if (template === "csp_status_gender_table") {
    built = buildModernJobsCspStatusGenderTableDefinition(field, data);
  } else if (template === "departure_table") {
    built = buildModernJobsDepartureTableDefinition(field, data);
  } else if (template === "diploma_gender_age_table") {
    built = buildModernJobsDiplomaTableDefinition(field, data);
  } else if (template === "first_time_workers_table") {
    built = buildModernJobsFirstTimeWorkersTableDefinition(field, data);
  } else if (template === "internship_table") {
    built = buildModernJobsInternshipTableDefinition(field, data);
  }
  return built ? applyQuizRequired(built, data) : null;
}


// ── Guided-only definitions ──────────────────────────────────────────────
// Classic tables that the grid (Tableau) mode keeps rendering with
// TableRenderer exactly as before. In Guidé mode they need a question-by-
// question version too, otherwise a grid would appear in the middle of the
// guided flow. These definitions use the SAME cell keys and the SAME
// recalculation functions as TableRenderer's configs for these templates
// (statusGenderRow / typeGenderRow / genderRow + recalculate*), so the data
// written is identical whichever mode is used.

export const GUIDED_ONLY_TEMPLATES = new Set([
  "vulnerable_named_rows_table",
  "dismissal_unemployment_table",
  "reasons_table",
  "skills_table",
  "training_table",
]);

const GUIDED_ONLY_ADAPTIVE: FixedMatrixDefinition["adaptive"] = {
  gridSuitable: false,
  guidedSuitable: true,
  allowUserToggle: false,
};

/** Group × (Homme, Femme, Total) columns — the status/type-gender shape. */
function groupGenderColumns(groups: { fr: string; en: string }[]) {
  const columns: StatisticalColumnDefinition[] = [];
  groups.forEach((g, gIdx) => {
    MFT_LABELS.forEach((mft, mIdx) => {
      columns.push({
        key: `c_${gIdx}_${mIdx}`,
        header: mft,
        kind: mIdx === MFT_LABELS.length - 1 || gIdx === groups.length - 1 ? "computed" : "number",
        align: "right",
        width: 95,
        group: g,
      });
    });
  });
  return { columns, headerGroups: groups.map((g) => ({ title: g, colSpan: MFT_LABELS.length })) };
}

function groupGenderRows(
  columns: StatisticalColumnDefinition[],
  rowKeys: string[],
  labels: { fr: string; en: string }[],
  cellIdsFor: (rowKey: string) => string[],
): StatisticalRowDefinition[] {
  const toCells = (ids: string[], forceComputed: boolean) => {
    const cells: Record<string, StatisticalCellDefinition> = {};
    ids.forEach((cellId, cIdx) => {
      const col = columns[cIdx];
      cells[col.key] = {
        key: col.key,
        fieldKey: cellId,
        kind: forceComputed || isComputedCspCell(cellId) ? "computed" : "number",
        min: 0,
      };
    });
    return cells;
  };
  return [
    ...rowKeys.map((rKey, i) => ({ id: rKey, label: labels[i], cells: toCells(cellIdsFor(rKey), false) })),
    { id: "total", label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" }, isTotal: true, cells: toCells(cellIdsFor("total"), true) },
  ];
}

/** Homme / Femme / Total columns — tables with sex as the only column dimension. */
function sexColumns(): StatisticalColumnDefinition[] {
  return [
    { key: "male", header: SEX_COLUMN_LABELS.male, kind: "number", align: "right", width: 130 },
    { key: "female", header: SEX_COLUMN_LABELS.female, kind: "number", align: "right", width: 130 },
    { key: "total", header: SEX_COLUMN_LABELS.total, kind: "computed", align: "right", width: 130 },
  ];
}

/** Category rows × sex, plus the grand-total row (keys `${prefix}_${row}_${sex}`). */
function sexRows(rowKeys: readonly string[], labels: { fr: string; en: string }[], prefix: string): StatisticalRowDefinition[] {
  const toCells = (row: string, computed: boolean): Record<string, StatisticalCellDefinition> => ({
    male: { key: "male", fieldKey: `${prefix}_${row}_male`, kind: computed ? "computed" : "number", min: 0 },
    female: { key: "female", fieldKey: `${prefix}_${row}_female`, kind: computed ? "computed" : "number", min: 0 },
    total: { key: "total", fieldKey: `${prefix}_${row}_total`, kind: "computed" },
  });
  return [
    ...rowKeys.map((row, i) => ({ id: row, label: labels[i], cells: toCells(row, false) })),
    { id: "total", label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" }, isTotal: true, cells: toCells("total", true) },
  ];
}

/**
 * csp_status_gender_table without a status dimension — Administration
 * S21Q03: catégorie (fonctionnaire, décisionnaire, contractuelle) × sexe.
 */
function buildCategoryGenderDefinition(field: OnefopField, tableId: string, rowKeys: string[]): FixedMatrixDefinition {
  return {
    id: tableId,
    paperCode: field.paperCode ?? tableId.toUpperCase(),
    title: field.label ?? { fr: tableId, en: tableId },
    type: "fixed-matrix",
    rowHeaderLabel: { fr: "Catégorie Socio-Professionnelle", en: "Occupational Category" },
    columns: sexColumns(),
    rows: sexRows(rowKeys, rowKeys.map(rowLabel), tableId),
    hasTotalRow: true,
    totalRowLabel: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    defaultMobileView: "guided",
    calculationMode: "materialized",
    adaptive: {
      gridSuitable: true,
      guidedSuitable: true,
      allowUserToggle: true,
      desktopMode: "grid",
      mobileMode: "guided",
      preferredMode: "grid",
    },
    rawRows: rowKeys,
    recalc: (d) => recalculateGenderOnly(d, tableId, rowKeys),
  };
}

export function getGuidedOnlyTableDefinition(field: OnefopField, data?: FormData): FixedMatrixDefinition | null {
  const table = field.table;
  const template = table?.template;
  if (!table || !template || !GUIDED_ONLY_TEMPLATES.has(template)) return null;
  const tableId = table.id;
  const base = {
    id: tableId,
    paperCode: field.paperCode ?? tableId.toUpperCase(),
    title: field.label ?? { fr: tableId, en: tableId },
    type: "fixed-matrix" as const,
    hasTotalRow: true,
    totalRowLabel: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    defaultMobileView: "guided" as const,
    calculationMode: "materialized" as const,
    adaptive: GUIDED_ONLY_ADAPTIVE,
  };

  if (template === "vulnerable_named_rows_table" && !tableHasStatusDimension(table)) {
    // Administration S21Q04: nature de la vulnérabilité × sexe.
    return applyQuizRequired({
      ...base,
      rowHeaderLabel: { fr: "Nature de la vulnérabilité", en: "Nature of vulnerability" },
      columns: sexColumns(),
      rows: sexRows(VULNERABLE_ROW_KEYS, VULNERABLE_ROW_LABELS, tableId),
      rawRows: [...VULNERABLE_ROW_KEYS],
      recalc: (d) => recalculateGenderOnly(d, tableId, VULNERABLE_ROW_KEYS),
    }, data);
  }

  if (template === "vulnerable_named_rows_table") {
    const { columns, headerGroups } = groupGenderColumns(STATUS_GENDER_GROUP_LABELS);
    const rows = groupGenderRows(columns, VULNERABLE_ROW_KEYS, VULNERABLE_ROW_LABELS, (r) => statusGenderRow(tableId, r));
    return applyQuizRequired({
      ...base,
      rowHeaderLabel: { fr: "Nature de la vulnérabilité", en: "Nature of vulnerability" },
      headerGroups,
      columns,
      rows,
      rawRows: [...VULNERABLE_ROW_KEYS],
      recalc: (d) => recalculateCspStatusGender(d, tableId, VULNERABLE_ROW_KEYS),
    }, data);
  }

  if (template === "dismissal_unemployment_table") {
    const defaultCspRows = table.rowKeys && table.rowKeys.length > 0 ? table.rowKeys : ["cadres", "foremen", "workers"];
    const { cspRows } = resolveTableScope(field, data, defaultCspRows);
    const types = ["dismissal", "technical_unemployment", "total"];
    const { columns, headerGroups } = groupGenderColumns(DISMISSAL_TYPE_LABELS);
    const rows = groupGenderRows(columns, cspRows, cspRows.map(rowLabel), (r) => typeGenderRow(tableId, r, types));
    return applyQuizRequired({
      ...base,
      rowHeaderLabel: { fr: "Catégorie Socio-Professionnelle", en: "Occupational Category" },
      headerGroups,
      columns,
      rows,
      rawRows: cspRows,
      recalc: (d) => recalculateDismissalUnemployment(d, tableId, cspRows),
    }, data);
  }

  // reasons / skills / training: one row per reason/domain (text + M/F/Total)
  const byTemplate: Record<string, { keys: string[]; labels: { fr: string; en: string }[] }> = {
    reasons_table: { keys: REASONS_ROW_KEYS, labels: REASONS_ROW_LABELS },
    skills_table: { keys: SKILLS_ROW_KEYS, labels: SKILLS_ROW_LABELS },
    training_table: { keys: TRAINING_ROW_KEYS, labels: TRAINING_ROW_LABELS },
  };
  const { keys, labels } = byTemplate[template];
  const embedded = EMBEDDED_ROW_TEXT[template];
  const columns: StatisticalColumnDefinition[] = [
    { key: "male", header: SEX_COLUMN_LABELS.male, kind: "number", align: "right", width: 130 },
    { key: "female", header: SEX_COLUMN_LABELS.female, kind: "number", align: "right", width: 130 },
    { key: "total", header: SEX_COLUMN_LABELS.total, kind: "computed", align: "right", width: 130 },
  ];
  const rows: StatisticalRowDefinition[] = keys.map((rKey, i) => {
    const textKey = embeddedRowTextFieldId(tableId, template, i + 1);
    const typed = textKey && typeof data?.[textKey] === "string" ? String(data[textKey]).trim() : "";
    return {
      id: rKey,
      // The summary table shows what the respondent typed ("Motif 1" until then).
      label: typed ? { fr: `${labels[i].fr} : ${typed}`, en: `${labels[i].en}: ${typed}` } : labels[i],
      labelText: textKey && embedded
        ? {
            fieldKey: textKey,
            label: { fr: `${embedded.header.fr} ${i + 1}`, en: `${embedded.header.en} ${i + 1}` },
            placeholder: embedded.placeholder,
          }
        : undefined,
      cells: {
        male: { key: "male", fieldKey: `${tableId}_${rKey}_male`, kind: "number", min: 0 },
        female: { key: "female", fieldKey: `${tableId}_${rKey}_female`, kind: "number", min: 0 },
        total: { key: "total", fieldKey: `${tableId}_${rKey}_total`, kind: "computed" },
      },
    };
  });
  rows.push({
    id: "total",
    label: { fr: "TOTAL GÉNÉRAL", en: "GRAND TOTAL" },
    isTotal: true,
    cells: {
      male: { key: "male", fieldKey: `${tableId}_total_male`, kind: "computed" },
      female: { key: "female", fieldKey: `${tableId}_total_female`, kind: "computed" },
      total: { key: "total", fieldKey: `${tableId}_total_total`, kind: "computed" },
    },
  });
  return applyQuizRequired({
    ...base,
    rowHeaderLabel: embedded?.header ?? { fr: "", en: "" },
    columns,
    rows,
    rawRows: [...keys],
    recalc: recalculateGenderOnly,
  }, data);
}
