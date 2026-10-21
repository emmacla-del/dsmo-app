// src/lib/register-activity.ts
//
// The two activity questions the registration wizard asks, in line with
// Section 1 of the enterprise, cooperative, CTD, NGO, administration and
// project forms: « Secteur d'activité » (S1Q06, COOP/CTD/ONG_S1Q07,
// ADMIN_S1Q06, PP_S1Q08) and « Branche d'activité » (the question after it).
// The VT form asks neither, so the VT registration does not either.
//
// The SECTOR is the form's own three answers, stored with the form's option
// values so the questionnaire can be pre-filled with them unchanged.
//
// The BRANCH is a row of the `sectors` reference table. Despite its name, that
// table holds branches -- agriculture, commerce, enseignement… -- and each
// row's `category` is the sector it belongs to. The registration stores the
// row's id (Company.sectorId) and its French name (Company.branch), so the
// sector is read back from the branch and needs no column of its own.
import type { EntityType } from "./register-constants";
import type { RegisterOption } from "./register-options";

// The values are the AST's option values (onefop_ast.dart, S1Q06 and its five
// siblings), the strings the questionnaire stores. They must not change.
export const ACTIVITY_SECTOR_OPTIONS: RegisterOption[] = [
  { value: "Primaire/ Primary", label: { fr: "Primaire", en: "Primary" } },
  { value: "Secondaire/ Secondary", label: { fr: "Secondaire", en: "Secondary" } },
  { value: "Tertiaire/ Tertiary", label: { fr: "Tertiaire", en: "Tertiary" } },
];

// A branch row's category, as the form's sector. « Public » is the table's
// own fourth category (public administration, extraterritorial bodies); both
// are services, so the form files them under Tertiaire.
const SECTOR_OF_CATEGORY: Record<string, string> = {
  Primary: "Primaire/ Primary",
  Secondary: "Secondaire/ Secondary",
  Tertiary: "Tertiaire/ Tertiary",
  Public: "Tertiaire/ Tertiary",
};

// The form's sector for a branch, or undefined for a category the form has
// no answer for. Never a guess.
export function sectorOfBranch(category: string | null | undefined): string | undefined {
  return category ? SECTOR_OF_CATEGORY[category] : undefined;
}

// Branches only some kinds of body can be in. Keyed by the row's French name,
// which the table holds unique. A branch not listed here is offered to every
// type that asks the question.
const BRANCH_ONLY_FOR: Record<string, readonly EntityType[]> = {
  "Administration publique et défense": ["administration", "ctd", "projectProgram"],
  "Organismes extraterritoriaux": ["ong", "projectProgram"],
};

export interface BranchRow {
  id: string;
  name: string;
  nameEn?: string | null;
  category?: string | null;
}

// The branches offered once a sector is chosen: those of that sector which
// the entity type can be in. Nothing until a sector is chosen.
export function branchesFor<T extends BranchRow>(
  branches: readonly T[] | undefined,
  sector: string | undefined,
  entityType: EntityType | null,
): T[] {
  if (!branches || !sector) return [];
  return branches.filter((b) => {
    if (sectorOfBranch(b.category) !== sector) return false;
    const only = BRANCH_ONLY_FOR[b.name];
    return !only || (entityType !== null && only.includes(entityType));
  });
}

// `data` without its branch when that branch is no longer offered -- the
// sector was changed, or the entity type. Called with the answers as they
// are about to be, so a branch never outlives the choice that offered it.
// While the list has not loaded, nothing can be checked and nothing is
// dropped.
export function dropUnofferedBranch(
  data: Record<string, string>,
  branches: readonly BranchRow[] | undefined,
  entityType: EntityType | null,
): Record<string, string> {
  const id = data.branchId;
  if (!id || !branches) return data;
  if (branchesFor(branches, data.activitySector, entityType).some((b) => b.id === id)) return data;
  const next = { ...data };
  delete next.branchId;
  return next;
}
