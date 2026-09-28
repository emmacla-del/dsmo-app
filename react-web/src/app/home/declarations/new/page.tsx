"use client";

// Port of lib/screens/dsmo/declaration_wizard_screen.dart
// 3-step wizard: Step 1 = Identity, Step 2 = Workforce, Step 3 = Qualitative.
// On Step 3 submit → calls POST /dsmo/declaration with the full payload.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getMyCompany,
  getRegions,
  getDepartmentsByRegion,
  getSubdivisionsByDepartment,
  getSectors,
  submitDsmoDeclaration,
  saveDsmoDraft,
  getDsmoDraft,
  deleteDsmoDraft,
  type DsmoDeclarationPayload,
  type DsmoMovementPayload,
} from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────

type MovementType = "rec" | "pro" | "lic" | "ret" | "dec";
const MOV_SUFFIXES = ["1_3", "4_6", "7_9", "10_12", "nd"] as const;
type MovKey = `${MovementType}_${(typeof MOV_SUFFIXES)[number]}`;

function makeMovements(): Record<MovKey, string> {
  const m: Partial<Record<MovKey, string>> = {};
  for (const p of ["rec", "pro", "lic", "ret", "dec"] as MovementType[]) {
    for (const s of MOV_SUFFIXES) m[`${p}_${s}`] = "0";
  }
  return m as Record<MovKey, string>;
}

interface LocationItem { id: string; name: string; [k: string]: unknown }

// ── Main component ─────────────────────────────────────────────────────────

export default function DsmoDeclarationWizardPage() {
  const router = useRouter();
  const t = useTranslations();

  // ── Label helpers (bilingual, matches _kDsmoWizardStrings) ────────────────
  const L = {
    appTitle: t("homeDeclarationsNewPage.appTitle"),
    step1: t("homeDeclarationsNewPage.stepIdentification"),
    step2: t("homeDeclarationsNewPage.stepWorkforce"),
    step3: t("homeDeclarationsNewPage.stepAdditionalInfo"),
    btnContinue: t("homeDeclarationsNewPage.btnContinue"),
    btnBack: t("homeDeclarationsNewPage.btnBack"),
    btnSubmit: t("homeDeclarationsNewPage.btnSubmit"),
    sectionIdentification: t("homeDeclarationsNewPage.sectionIdentification"),
    sectionLocalisation: t("homeDeclarationsNewPage.sectionLocalisation"),
    sectionCoordonnees: t("homeDeclarationsNewPage.sectionCoordonnees"),
    fieldBudgetYear: t("homeDeclarationsNewPage.fieldBudgetYear"),
    fieldFillingDate: t("homeDeclarationsNewPage.fieldFillingDate"),
    fieldCompanyName: t("homeDeclarationsNewPage.fieldCompanyName"),
    fieldParentCompany: t("homeDeclarationsNewPage.fieldParentCompany"),
    fieldMainActivity: t("homeDeclarationsNewPage.fieldMainActivity"),
    fieldSecondaryActivity: t("homeDeclarationsNewPage.fieldSecondaryActivity"),
    fieldRegion: t("homeDeclarationsNewPage.fieldRegion"),
    fieldDepartment: t("homeDeclarationsNewPage.fieldDepartment"),
    fieldSubdivision: t("homeDeclarationsNewPage.fieldSubdivision"),
    fieldAddress: t("homeDeclarationsNewPage.fieldAddress"),
    fieldFax: t("homeDeclarationsNewPage.fieldFax"),
    fieldTaxNumber: t("homeDeclarationsNewPage.fieldTaxNumber"),
    fieldCapital: t("homeDeclarationsNewPage.fieldCapital"),
    fieldCnps: t("homeDeclarationsNewPage.fieldCnps"),
    sectionWorkforceCurrent: t("homeDeclarationsNewPage.sectionWorkforceCurrent"),
    helperCurrentWorkforce: t("homeDeclarationsNewPage.helperCurrentWorkforce"),
    sectionWorkforcePrevious: t("homeDeclarationsNewPage.sectionWorkforcePrevious"),
    helperOptionalTotal: t("homeDeclarationsNewPage.helperOptionalTotal"),
    sectionMovements: t("homeDeclarationsNewPage.sectionMovements"),
    helperMovementTable: t("homeDeclarationsNewPage.helperMovementTable"),
    fieldMen: t("homeDeclarationsNewPage.fieldMen"),
    fieldWomen: t("homeDeclarationsNewPage.fieldWomen"),
    fieldTotal: t("homeDeclarationsNewPage.fieldTotal"),
    colMovement: t("homeDeclarationsNewPage.colMovement"),
    colCat13: t("homeDeclarationsNewPage.colCat13"),
    colCat46: t("homeDeclarationsNewPage.colCat46"),
    colCat79: t("homeDeclarationsNewPage.colCat79"),
    colCat1012: t("homeDeclarationsNewPage.colCat1012"),
    colNd: t("homeDeclarationsNewPage.colNd"),
    colTotal: t("homeDeclarationsNewPage.colTotal"),
    rowRecruitment: t("homeDeclarationsNewPage.rowRecruitment"),
    rowPromotion: t("homeDeclarationsNewPage.rowPromotion"),
    rowDismissal: t("homeDeclarationsNewPage.rowDismissal"),
    rowRetirement: t("homeDeclarationsNewPage.rowRetirement"),
    rowDeath: t("homeDeclarationsNewPage.rowDeath"),
    sectionQualitative: t("homeDeclarationsNewPage.sectionQualitative"),
    qTraining: t("homeDeclarationsNewPage.qTraining"),
    qRecruitmentNext: t("homeDeclarationsNewPage.qRecruitmentNext"),
    qCamerounisation: t("homeDeclarationsNewPage.qCamerounisation"),
    qTempAgencies: t("homeDeclarationsNewPage.qTempAgencies"),
    qTempAgencyDetails: t("homeDeclarationsNewPage.qTempAgencyDetails"),
  };

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 1: Identity
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);
  const [budgetYear, setBudgetYear] = useState(currentYear);
  const [fillingDate, setFillingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [companyName, setCompanyName] = useState("");
  const [parentCompany, setParentCompany] = useState("");
  const [secondaryActivity, setSecondaryActivity] = useState("");
  const [address, setAddress] = useState("");
  const [fax, setFax] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [cnps, setCnps] = useState("");
  const [capital, setCapital] = useState("");

  // Cascading location
  const [regions, setRegions] = useState<LocationItem[]>([]);
  const [departments, setDepartments] = useState<LocationItem[]>([]);
  const [subdivisions, setSubdivisions] = useState<LocationItem[]>([]);
  const [sectors, setSectors] = useState<LocationItem[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingSubdivs, setLoadingSubdivs] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [selectedSectorId, setSelectedSectorId] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedSubdivId, setSelectedSubdivId] = useState("");

  // Step 2: Workforce
  const [menCount, setMenCount] = useState("");
  const [womenCount, setWomenCount] = useState("");
  const [lastYearMen, setLastYearMen] = useState("");
  const [lastYearWomen, setLastYearWomen] = useState("");
  const [movements, setMovements] = useState<Record<MovKey, string>>(makeMovements);

  // Auto-calculated totals (read-only)
  const totalEmp = (parseInt(menCount) || 0) + (parseInt(womenCount) || 0);
  const lastYearTotal = (parseInt(lastYearMen) || 0) + (parseInt(lastYearWomen) || 0);

  function movRowTotal(p: MovementType): number {
    return MOV_SUFFIXES.reduce((s, k) => s + (parseInt(movements[`${p}_${k}`]) || 0), 0);
  }
  function movColTotal(s: string): number {
    return (["rec", "pro", "lic", "ret", "dec"] as MovementType[]).reduce(
      (acc, p) => acc + (parseInt(movements[`${p}_${s as (typeof MOV_SUFFIXES)[number]}`]) || 0), 0
    );
  }
  function movGrandTotal(): number {
    return Object.values(movements).reduce((s, v) => s + (parseInt(v) || 0), 0);
  }

  // Step 3: Qualitative
  const [hasTrainingCenter, setHasTrainingCenter] = useState(false);
  const [recruitmentPlansNext, setRecruitmentPlansNext] = useState(false);
  const [camerounisationPlan, setCamerounisationPlan] = useState(false);
  const [usesTempAgencies, setUsesTempAgencies] = useState(false);
  const [tempAgencyDetails, setTempAgencyDetails] = useState("");

  // Autosave timer
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutosave = useCallback(() => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      saveDsmoDraft(budgetYear, buildSnapshot()).catch(() => {});
    }, 2000);
  }, [budgetYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Load sectors, regions, and company profile in parallel
    Promise.allSettled([
      getSectors(),
      getRegions(),
      getMyCompany(),
      getDsmoDraft(),
    ]).then(([sectRes, regRes, compRes, draftRes]) => {
      if (sectRes.status === "fulfilled") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSectors((sectRes.value as any[]).map((s: any) => ({ id: s.id ?? s.code ?? s.name, name: s.name ?? s.label ?? s.id })));
      }
      setLoadingSectors(false);

      if (regRes.status === "fulfilled") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const regs = (regRes.value as any[]).map((r: any) => ({ id: r.id ?? r.name, name: r.name ?? r.label ?? r.id }));
        setRegions(regs);

        // Autofill from company profile
        if (compRes.status === "fulfilled" && compRes.value) {
          const c = compRes.value;
          setCompanyName(c.name ?? "");
          setParentCompany(c.parentCompany ?? "");
          setAddress(c.address ?? "");
          setFax(c.fax ?? "");
          setTaxNumber(c.taxNumber ?? "");
          setCnps(c.cnpsNumber ?? "");
          if (c.socialCapital != null) setCapital(String(c.socialCapital));
          if (c.totalEmployees != null) setMenCount(String(c.menCount ?? ""));
          if (c.womenCount != null) setWomenCount(String(c.womenCount ?? ""));

          // Auto-select sector by name
          if (c.mainActivity && sectRes.status === "fulfilled") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const match = (sectRes.value as any[]).find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (s: any) => (s.name ?? "").toLowerCase() === (c.mainActivity ?? "").toLowerCase()
            );
            if (match) setSelectedSectorId(match.id ?? match.code ?? match.name);
          }

          // Auto-select region by name, then cascade
          if (c.region) {
            const rMatch = regs.find(
              (r) => r.name.toLowerCase() === (c.region ?? "").toLowerCase()
            );
            if (rMatch) {
              setSelectedRegionId(rMatch.id);
              getDepartmentsByRegion(rMatch.id).then((depts) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mappedDepts = (depts as any[]).map((d: any) => ({ id: d.id ?? d.name, name: d.name ?? d.label }));
                setDepartments(mappedDepts);
                if (c.department) {
                  const dMatch = mappedDepts.find(
                    (d) => d.name.toLowerCase() === (c.department ?? "").toLowerCase()
                  );
                  if (dMatch) {
                    setSelectedDeptId(dMatch.id);
                    getSubdivisionsByDepartment(dMatch.id).then((subdivs) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const mappedSubdivs = (subdivs as any[]).map((s: any) => ({ id: s.id ?? s.name, name: s.name ?? s.label }));
                      setSubdivisions(mappedSubdivs);
                      if (c.subdivision) {
                        const sMatch = mappedSubdivs.find(
                          (s) => s.name.toLowerCase() === (c.subdivision ?? "").toLowerCase()
                        );
                        if (sMatch) setSelectedSubdivId(sMatch.id);
                      }
                    }).catch(() => {});
                  }
                }
              }).catch(() => {});
            }
          }
        }
      }
      setLoadingRegions(false);

      // Resume draft if found (takes precedence over company profile autofill)
      if (draftRes.status === "fulfilled" && draftRes.value?.draftData) {
        restoreDraft(draftRes.value.draftData as Record<string, unknown>);
      }
    });
  }, []);

  function buildSnapshot() {
    return {
      budgetYear, fillingDate, companyName, parentCompany, secondaryActivity,
      address, fax, taxNumber, cnps, capital,
      selectedSectorId, selectedRegionId, selectedDeptId, selectedSubdivId,
      menCount, womenCount, lastYearMen, lastYearWomen, movements,
      hasTrainingCenter, recruitmentPlansNext, camerounisationPlan,
      usesTempAgencies, tempAgencyDetails,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function restoreDraft(data: Record<string, any>) {
    if (data.budgetYear) setBudgetYear(data.budgetYear);
    if (data.fillingDate) setFillingDate(data.fillingDate);
    if (data.companyName) setCompanyName(data.companyName);
    if (data.parentCompany !== undefined) setParentCompany(data.parentCompany);
    if (data.secondaryActivity !== undefined) setSecondaryActivity(data.secondaryActivity);
    if (data.address) setAddress(data.address);
    if (data.fax !== undefined) setFax(data.fax);
    if (data.taxNumber) setTaxNumber(data.taxNumber);
    if (data.cnps !== undefined) setCnps(data.cnps);
    if (data.capital !== undefined) setCapital(data.capital);
    if (data.selectedSectorId) setSelectedSectorId(data.selectedSectorId);
    if (data.selectedRegionId) setSelectedRegionId(data.selectedRegionId);
    if (data.selectedDeptId) setSelectedDeptId(data.selectedDeptId);
    if (data.selectedSubdivId) setSelectedSubdivId(data.selectedSubdivId);
    if (data.menCount !== undefined) setMenCount(data.menCount);
    if (data.womenCount !== undefined) setWomenCount(data.womenCount);
    if (data.lastYearMen !== undefined) setLastYearMen(data.lastYearMen);
    if (data.lastYearWomen !== undefined) setLastYearWomen(data.lastYearWomen);
    if (data.movements) setMovements({ ...makeMovements(), ...data.movements });
    if (data.hasTrainingCenter !== undefined) setHasTrainingCenter(data.hasTrainingCenter);
    if (data.recruitmentPlansNext !== undefined) setRecruitmentPlansNext(data.recruitmentPlansNext);
    if (data.camerounisationPlan !== undefined) setCamerounisationPlan(data.camerounisationPlan);
    if (data.usesTempAgencies !== undefined) setUsesTempAgencies(data.usesTempAgencies);
    if (data.tempAgencyDetails !== undefined) setTempAgencyDetails(data.tempAgencyDetails);
  }

  async function handleRegionChange(id: string) {
    setSelectedRegionId(id);
    setSelectedDeptId("");
    setSelectedSubdivId("");
    setDepartments([]);
    setSubdivisions([]);
    if (!id) return;
    setLoadingDepts(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const depts = (await getDepartmentsByRegion(id) as any[]).map((d: any) => ({ id: d.id ?? d.name, name: d.name ?? d.label }));
      setDepartments(depts);
    } finally {
      setLoadingDepts(false);
    }
    scheduleAutosave();
  }

  async function handleDeptChange(id: string) {
    setSelectedDeptId(id);
    setSelectedSubdivId("");
    setSubdivisions([]);
    if (!id) return;
    setLoadingSubdivs(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subdivs = (await getSubdivisionsByDepartment(id) as any[]).map((s: any) => ({ id: s.id ?? s.name, name: s.name ?? s.label }));
      setSubdivisions(subdivs);
    } finally {
      setLoadingSubdivs(false);
    }
    scheduleAutosave();
  }

  // ── Step validation ────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = t("homeDeclarationsNewPage.errRequired");
    if (!selectedSectorId) errs.sector = t("homeDeclarationsNewPage.errSelectSector");
    if (!selectedRegionId) errs.region = t("homeDeclarationsNewPage.errSelectRegion");
    if (!selectedDeptId) errs.department = t("homeDeclarationsNewPage.errSelectDept");
    if (!selectedSubdivId) errs.subdivision = t("homeDeclarationsNewPage.errSelectSubdivision");
    if (!address.trim()) errs.address = t("homeDeclarationsNewPage.errRequired");
    if (!taxNumber.trim()) errs.taxNumber = t("homeDeclarationsNewPage.errRequired");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (totalEmp <= 0) errs.total = t("homeDeclarationsNewPage.errTotalPositive");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setFieldErrors({});
    saveDsmoDraft(budgetYear, buildSnapshot()).catch(() => {});
    setStep((s) => s + 1);
  }

  function goBack() { setStep((s) => Math.max(0, s - 1)); }

  function buildPayload(): DsmoDeclarationPayload {
    const sectorName = sectors.find((s) => s.id === selectedSectorId)?.name;
    const regionName = regions.find((r) => r.id === selectedRegionId)?.name;
    const deptName = departments.find((d) => d.id === selectedDeptId)?.name;
    const subdivName = subdivisions.find((s) => s.id === selectedSubdivId)?.name;

    function buildMov(type: DsmoMovementPayload["movementType"], prefix: MovementType): DsmoMovementPayload {
      return {
        movementType: type,
        cat1_3: parseInt(movements[`${prefix}_1_3`]) || 0,
        cat4_6: parseInt(movements[`${prefix}_4_6`]) || 0,
        cat7_9: parseInt(movements[`${prefix}_7_9`]) || 0,
        cat10_12: parseInt(movements[`${prefix}_10_12`]) || 0,
        catNonDeclared: parseInt(movements[`${prefix}_nd`]) || 0,
      };
    }

    return {
      year: budgetYear,
      fillingDate,
      companyData: {
        name: companyName.trim(),
        parentCompany: parentCompany.trim() || null,
        mainActivity: sectorName,
        secondaryActivity: secondaryActivity.trim() || null,
        region: regionName,
        department: deptName,
        subdivision: subdivName,
        address: address.trim(),
        fax: fax.trim() || null,
        taxNumber: taxNumber.trim(),
        cnpsNumber: cnps.trim() || null,
        socialCapital: capital.trim() ? parseInt(capital) : null,
        totalEmployees: totalEmp,
        menCount: menCount ? parseInt(menCount) : null,
        womenCount: womenCount ? parseInt(womenCount) : null,
        lastYearTotal: lastYearMen || lastYearWomen ? lastYearTotal : null,
        lastYearMenCount: lastYearMen ? parseInt(lastYearMen) : null,
        lastYearWomenCount: lastYearWomen ? parseInt(lastYearWomen) : null,
      },
      movements: [
        buildMov("RECRUITMENT", "rec"),
        buildMov("PROMOTION", "pro"),
        buildMov("DISMISSAL", "lic"),
        buildMov("RETIREMENT", "ret"),
        buildMov("DEATH", "dec"),
      ],
      qualitative: {
        hasTrainingCenter,
        recruitmentPlansNext,
        camerounisationPlan,
        usesTempAgencies,
        tempAgencyDetails: usesTempAgencies ? tempAgencyDetails.trim() || null : null,
      },
    };
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitDsmoDeclaration(buildPayload());
      // Clear the server-side draft so a future new-declaration flow for the
      // same year does not pre-populate stale data from this submission.
      deleteDsmoDraft().catch(() => {});
      router.push("/home/declarations");
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : t("homeDeclarationsNewPage.submissionError"));
    } finally {
      setSubmitting(false);
    }
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const accent = "var(--cam-accent)";

  function SectionHeader({ title }: { title: string }) {
    return (
      <div style={{ margin: "20px 0 8px", fontWeight: 700, fontSize: 13, color: accent, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${accent}`, paddingBottom: 4 }}>
        {title}
      </div>
    );
  }

  function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--cam-text-muted)", marginBottom: 4, fontWeight: 500 }}>{label}</label>
        {children}
        {error && <div style={{ color: "var(--cam-error, #dc2626)", fontSize: 11, marginTop: 2 }}>{error}</div>}
      </div>
    );
  }

  function NumInput({ value, onChange, placeholder = "0", readOnly = false }: { value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean }) {
    return (
      <input
        className="cam-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value.replace(/\D/g, "")) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          width: "100%",
          fontSize: 13,
          background: readOnly ? "var(--cam-accent-soft, #e8f0fe)" : undefined,
          color: readOnly ? accent : undefined,
          fontWeight: readOnly ? 700 : undefined,
        }}
      />
    );
  }

  function CascadeSelect({ value, onChange, items, loading, disabled, placeholder }: {
    value: string; onChange: (id: string) => void;
    items: LocationItem[]; loading: boolean; disabled?: boolean; placeholder?: string;
  }) {
    return (
      <select
        className="cam-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || disabled}
        style={{ width: "100%", fontSize: 13 }}
      >
        <option value="">{loading ? t("common.loading") : (placeholder ?? t("homeDeclarationsNewPage.selectPlaceholder"))}</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    );
  }

  // ── Step content renderers ─────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={L.fieldBudgetYear}>
            <select className="cam-input" style={{ width: "100%", fontSize: 13 }} value={budgetYear} onChange={(e) => { setBudgetYear(Number(e.target.value)); scheduleAutosave(); }}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label={L.fieldFillingDate}>
            <input className="cam-input" type="date" value={fillingDate} onChange={(e) => { setFillingDate(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
          </Field>
        </div>

        <SectionHeader title={L.sectionIdentification} />

        <Field label={L.fieldCompanyName} error={fieldErrors.companyName}>
          <input className="cam-input" value={companyName} onChange={(e) => { setCompanyName(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
        </Field>
        <Field label={L.fieldParentCompany}>
          <input className="cam-input" value={parentCompany} onChange={(e) => { setParentCompany(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
        </Field>
        <Field label={L.fieldMainActivity} error={fieldErrors.sector}>
          <select className="cam-input" style={{ width: "100%", fontSize: 13 }} value={selectedSectorId} onChange={(e) => { setSelectedSectorId(e.target.value); scheduleAutosave(); }} disabled={loadingSectors}>
            <option value="">{loadingSectors ? t("common.loading") : t("homeDeclarationsNewPage.selectPlaceholder")}</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={L.fieldSecondaryActivity}>
          <input className="cam-input" value={secondaryActivity} onChange={(e) => { setSecondaryActivity(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
        </Field>

        <SectionHeader title={L.sectionLocalisation} />

        <Field label={L.fieldRegion} error={fieldErrors.region}>
          <CascadeSelect value={selectedRegionId} onChange={handleRegionChange} items={regions} loading={loadingRegions} />
        </Field>
        <Field label={L.fieldDepartment} error={fieldErrors.department}>
          <CascadeSelect value={selectedDeptId} onChange={handleDeptChange} items={departments} loading={loadingDepts} disabled={!selectedRegionId} placeholder={!selectedRegionId ? t("homeDeclarationsNewPage.chooseRegionFirst") : undefined} />
        </Field>
        <Field label={L.fieldSubdivision} error={fieldErrors.subdivision}>
          <CascadeSelect value={selectedSubdivId} onChange={(id) => { setSelectedSubdivId(id); scheduleAutosave(); }} items={subdivisions} loading={loadingSubdivs} disabled={!selectedDeptId} placeholder={!selectedDeptId ? t("homeDeclarationsNewPage.chooseDeptFirst") : undefined} />
        </Field>

        <SectionHeader title={L.sectionCoordonnees} />

        <Field label={L.fieldAddress} error={fieldErrors.address}>
          <input className="cam-input" value={address} onChange={(e) => { setAddress(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <Field label={L.fieldFax}>
            <input className="cam-input" value={fax} onChange={(e) => { setFax(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
          </Field>
          <Field label={L.fieldTaxNumber} error={fieldErrors.taxNumber}>
            <input className="cam-input" value={taxNumber} onChange={(e) => { setTaxNumber(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={L.fieldCapital}>
            <NumInput value={capital} onChange={(v) => { setCapital(v); scheduleAutosave(); }} />
          </Field>
          <Field label={L.fieldCnps}>
            <input className="cam-input" value={cnps} onChange={(e) => { setCnps(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
          </Field>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const movRows: { label: string; prefix: MovementType }[] = [
      { label: L.rowRecruitment, prefix: "rec" },
      { label: L.rowPromotion, prefix: "pro" },
      { label: L.rowDismissal, prefix: "lic" },
      { label: L.rowRetirement, prefix: "ret" },
      { label: L.rowDeath, prefix: "dec" },
    ];

    return (
      <div>
        <SectionHeader title={L.sectionWorkforceCurrent} />
        <p style={{ fontSize: 12, color: "var(--cam-text-muted)", margin: "0 0 8px" }}>{L.helperCurrentWorkforce}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label={L.fieldMen}>
            <NumInput value={menCount} onChange={(v) => { setMenCount(v); scheduleAutosave(); }} />
          </Field>
          <Field label={L.fieldWomen}>
            <NumInput value={womenCount} onChange={(v) => { setWomenCount(v); scheduleAutosave(); }} />
          </Field>
          <Field label={t("homeDeclarationsNewPage.totalAutoLabel")}>
            <NumInput value={String(totalEmp)} readOnly />
          </Field>
        </div>
        {fieldErrors.total && <div style={{ color: "var(--cam-error, #dc2626)", fontSize: 12, marginBottom: 8 }}>{fieldErrors.total}</div>}

        <SectionHeader title={L.sectionWorkforcePrevious} />
        <p style={{ fontSize: 12, color: "var(--cam-text-muted)", margin: "0 0 8px" }}>{L.helperOptionalTotal}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label={L.fieldMen}>
            <NumInput value={lastYearMen} onChange={(v) => { setLastYearMen(v); scheduleAutosave(); }} />
          </Field>
          <Field label={L.fieldWomen}>
            <NumInput value={lastYearWomen} onChange={(v) => { setLastYearWomen(v); scheduleAutosave(); }} />
          </Field>
          <Field label={t("homeDeclarationsNewPage.totalAutoLabel")}>
            <NumInput value={String(lastYearTotal)} readOnly />
          </Field>
        </div>

        <SectionHeader title={L.sectionMovements} />
        <p style={{ fontSize: 12, color: "var(--cam-text-muted)", margin: "0 0 10px" }}>{L.helperMovementTable}</p>

        {/* Movement table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--cam-surface-2, #f1f5f9)" }}>
                {[L.colMovement, L.colCat13, L.colCat46, L.colCat79, L.colCat1012, L.colNd, L.colTotal].map((h) => (
                  <th key={h} style={{ border: "1px solid var(--cam-border)", padding: "8px 10px", textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movRows.map(({ label, prefix }, ri) => (
                <tr key={prefix} style={{ background: ri % 2 === 0 ? "#fff" : "var(--cam-surface, #f8fafc)" }}>
                  <td style={{ border: "1px solid var(--cam-border)", padding: "6px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</td>
                  {MOV_SUFFIXES.map((suf) => (
                    <td key={suf} style={{ border: "1px solid var(--cam-border)", padding: 4, textAlign: "center" }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={movements[`${prefix}_${suf}`]}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          setMovements((m) => ({ ...m, [`${prefix}_${suf}`]: v }));
                          scheduleAutosave();
                        }}
                        style={{ width: 52, textAlign: "center", border: "1px solid var(--cam-border)", borderRadius: 4, padding: "4px 6px", fontSize: 12 }}
                      />
                    </td>
                  ))}
                  <td style={{ border: "1px solid var(--cam-border)", padding: "6px 10px", textAlign: "center", fontWeight: 700, color: accent, background: "var(--cam-accent-soft, #e8f0fe)" }}>
                    {movRowTotal(prefix)}
                  </td>
                </tr>
              ))}
              {/* Column totals row */}
              <tr style={{ background: "var(--cam-accent-soft, #e8f0fe)" }}>
                <td style={{ border: "1px solid var(--cam-border)", padding: "6px 10px", fontWeight: 700, color: accent }}>{L.colTotal}</td>
                {MOV_SUFFIXES.map((suf) => (
                  <td key={suf} style={{ border: "1px solid var(--cam-border)", padding: "6px 10px", textAlign: "center", fontWeight: 700, color: accent }}>
                    {movColTotal(suf)}
                  </td>
                ))}
                <td style={{ border: "1px solid var(--cam-border)", padding: "6px 10px", textAlign: "center", fontWeight: 800, color: accent, fontSize: 13 }}>
                  {movGrandTotal()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderStep3() {
    function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
      return (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", cursor: "pointer", borderBottom: "1px solid var(--cam-border)" }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => { onChange(e.target.checked); scheduleAutosave(); }}
            style={{ marginTop: 2, width: 18, height: 18, accentColor: accent, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: "var(--cam-text)", lineHeight: 1.4 }}>{label}</span>
        </label>
      );
    }

    return (
      <div>
        <SectionHeader title={L.sectionQualitative} />
        <Toggle label={L.qTraining} checked={hasTrainingCenter} onChange={setHasTrainingCenter} />
        <Toggle label={L.qRecruitmentNext} checked={recruitmentPlansNext} onChange={setRecruitmentPlansNext} />
        <Toggle label={L.qCamerounisation} checked={camerounisationPlan} onChange={setCamerounisationPlan} />
        <Toggle label={L.qTempAgencies} checked={usesTempAgencies} onChange={setUsesTempAgencies} />
        {usesTempAgencies && (
          <div style={{ marginTop: 8 }}>
            <Field label={L.qTempAgencyDetails}>
              <input className="cam-input" value={tempAgencyDetails} onChange={(e) => { setTempAgencyDetails(e.target.value); scheduleAutosave(); }} style={{ width: "100%", fontSize: 13 }} />
            </Field>
          </div>
        )}
        {submitError && <div className="cam-error-box" style={{ marginTop: 16 }}>{submitError}</div>}
      </div>
    );
  }

  // ── Step progress indicator ────────────────────────────────────────────────

  const steps = [L.step1, L.step2, L.step3];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
      {/* Page title */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--cam-text)", marginBottom: 20 }}>
        {L.appTitle}
      </h1>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28 }}>
        {steps.map((label, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: i < step ? accent : i === step ? accent : "var(--cam-border)",
              color: i <= step ? "#fff" : "var(--cam-text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13,
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: 10, color: i === step ? accent : "var(--cam-text-muted)", marginTop: 4, textAlign: "center", fontWeight: i === step ? 700 : 400 }}>
              {label}
            </div>
            {i < steps.length - 1 && (
              <div style={{ position: "absolute", display: "none" }} />
            )}
          </div>
        ))}
      </div>
      {/* Connector lines */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: -44, marginBottom: 28, paddingLeft: 48, paddingRight: 48 }}>
        {steps.slice(0, -1).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2, background: i < step ? accent : "var(--cam-border)" }} />
        ))}
      </div>

      {/* Step body */}
      <div style={{ background: "var(--cam-surface)", border: "1px solid var(--cam-border)", borderRadius: 12, padding: 24 }}>
        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" }}>
        {step > 0 && (
          <button className="cam-button cam-button-secondary" onClick={goBack} disabled={submitting}>
            {L.btnBack}
          </button>
        )}
        {step < 2 && (
          <button className="cam-button cam-button-primary" onClick={goNext}>
            {L.btnContinue}
          </button>
        )}
        {step === 2 && (
          <button className="cam-button cam-button-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("homeDeclarationsNewPage.submittingInProgress") : L.btnSubmit}
          </button>
        )}
      </div>
    </div>
  );
}
