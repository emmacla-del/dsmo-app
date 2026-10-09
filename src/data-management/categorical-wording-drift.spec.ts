// src/data-management/categorical-wording-drift.spec.ts
//
// E3 — the wording of section-1 categorical answers exists in three places
// that must agree exactly:
//   1. the AST option values (assets/schemas/onefop.schema.json, generated
//      from lib/core/focus/compiler/onefop_ast.dart) — what the respondent
//      picks and what the SPSS value labels / string values carry;
//   2. the normalizer's string → numeric-code mappers
//      (src/common/normalizers/flat-key-normalizer.ts) — what submission
//      turns the chosen wording into before the DTO;
//   3. the server's numeric-code → string maps (private methods of
//      QuestionnairesService, src/questionnaires/questionnaires.service.ts)
//      — what is written to the *Detail tables and therefore exported.
// For every option: normalizer(option) must be a non-zero code, distinct
// options must get distinct codes, and serverMap(code) must give the option
// back character for character. Read-only: nothing here changes a mapping.
//
// The server maps are private and that file belongs to another owner, so
// they are reached through QuestionnairesService.prototype without editing
// or copying them. No instance is built (the maps use no instance state).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  mapArea,
  mapCooperativeType,
  mapCouncilType,
  mapCtdType,
  mapLegalStatus,
  mapNature,
  mapPPStatus,
  mapSector,
  mapSize,
  mapStopReason,
  mapYesNo,
} from '../common/normalizers/flat-key-normalizer';
import { QuestionnairesService } from '../questionnaires/questionnaires.service';
import type { OnefopSchemaRoot } from '../onefop-schema-validation/onefop-schema.types';

const schema: OnefopSchemaRoot = JSON.parse(
  readFileSync(join(process.cwd(), 'assets', 'schemas', 'onefop.schema.json'), 'utf-8'),
);

function optionsOf(entity: string, fieldId: string): string[] {
  for (const sec of schema.entities[entity as keyof typeof schema.entities].sections) {
    const f = sec.fields.find((x) => x.id === fieldId);
    if (f) return (f.options ?? []).map((o) => o.value);
  }
  throw new Error(`Field ${fieldId} not found in ${entity}`);
}

type ServerMap = (code: number) => string;
function serverMap(name: string): ServerMap {
  const fn = (QuestionnairesService.prototype as any)[name];
  if (typeof fn !== 'function') throw new Error(`QuestionnairesService.${name} is gone — update this drift test`);
  return (code: number) => fn.call(undefined, code);
}

interface Case {
  entity: string;
  fieldId: string;
  normalizer: (v: string) => number;
  normalizerName: string;
  /** Private QuestionnairesService method, or null when the server stores the code itself. */
  server: string | null;
}

// Every AST field the normalizer maps with a string → number mapper
// (flat-key-normalizer.ts build*Dto: setNum(..., mapX)).
const CASES: Case[] = [
  { entity: 'enterprise', fieldId: 'S1Q01', normalizer: mapLegalStatus, normalizerName: 'mapLegalStatus', server: 'mapLegalStatus' },
  { entity: 'enterprise', fieldId: 'S1Q03', normalizer: mapArea, normalizerName: 'mapArea', server: 'mapArea' },
  { entity: 'enterprise', fieldId: 'S1Q06', normalizer: mapSector, normalizerName: 'mapSector', server: 'mapSector' },
  { entity: 'enterprise', fieldId: 'S1Q12', normalizer: mapSize, normalizerName: 'mapSize', server: 'mapCompanySize' },
  { entity: 'cooperative', fieldId: 'COOP_S1Q04', normalizer: mapArea, normalizerName: 'mapArea', server: 'mapArea' },
  { entity: 'cooperative', fieldId: 'COOP_S1Q07', normalizer: mapSector, normalizerName: 'mapSector', server: 'mapSector' },
  { entity: 'cooperative', fieldId: 'COOP_S1Q10', normalizer: mapCooperativeType, normalizerName: 'mapCooperativeType', server: 'mapCooperativeType' },
  { entity: 'ctd', fieldId: 'CTD_S1Q01', normalizer: mapCtdType, normalizerName: 'mapCtdType', server: 'mapCtdType' },
  { entity: 'ctd', fieldId: 'CTD_S1Q02', normalizer: mapCouncilType, normalizerName: 'mapCouncilType', server: 'mapCouncilType' },
  { entity: 'ctd', fieldId: 'CTD_S1Q04', normalizer: mapArea, normalizerName: 'mapArea', server: 'mapArea' },
  { entity: 'ctd', fieldId: 'CTD_S1Q07', normalizer: mapSector, normalizerName: 'mapSector', server: 'mapSector' },
  { entity: 'ong', fieldId: 'ONG_S1Q04', normalizer: mapArea, normalizerName: 'mapArea', server: 'mapArea' },
  { entity: 'ong', fieldId: 'ONG_S1Q07', normalizer: mapSector, normalizerName: 'mapSector', server: 'mapSector' },
  { entity: 'administration', fieldId: 'ADMIN_S1Q03', normalizer: mapArea, normalizerName: 'mapArea', server: 'mapArea' },
  { entity: 'administration', fieldId: 'ADMIN_S1Q06', normalizer: mapSector, normalizerName: 'mapSector', server: 'mapSector' },
  { entity: 'projectProgram', fieldId: 'PP_S1Q05', normalizer: mapArea, normalizerName: 'mapArea', server: 'mapArea' },
  { entity: 'projectProgram', fieldId: 'PP_S1Q08', normalizer: mapSector, normalizerName: 'mapSector', server: 'mapSector' },
  // No server string map: hasProject/hasSupervisedStructures are stored as
  // booleans (code === 1), nature as String(code), status/stopReason as the
  // code. Only the normalizer half can drift here.
  { entity: 'administration', fieldId: 'ADMIN_S1Q09', normalizer: mapYesNo, normalizerName: 'mapYesNo', server: null },
  { entity: 'administration', fieldId: 'ADMIN_S1Q11', normalizer: mapYesNo, normalizerName: 'mapYesNo', server: null },
  { entity: 'projectProgram', fieldId: 'PP_S1Q01', normalizer: mapNature, normalizerName: 'mapNature', server: null },
  { entity: 'projectProgram', fieldId: 'PP_S1Q13', normalizer: mapPPStatus, normalizerName: 'mapPPStatus', server: null },
  { entity: 'projectProgram', fieldId: 'PP_S1Q14', normalizer: mapStopReason, normalizerName: 'mapStopReason', server: null },
];

// Real current mismatches, kept visible instead of fixed (data mappings
// are out of scope for this test). Key: `${fieldId}::${option}`.
// None found at HEAD 642ddd94.
const KNOWN_MISMATCHES = new Set<string>([]);

describe('Categorical wording drift: AST options ↔ normalizer ↔ server maps (E3)', () => {
  for (const c of CASES) {
    describe(`${c.entity}.${c.fieldId} (${c.normalizerName}${c.server ? ` / ${c.server}` : ''})`, () => {
      const options = optionsOf(c.entity, c.fieldId);

      it('has options in the AST', () => {
        expect(options.length).toBeGreaterThan(0);
      });

      for (const option of options) {
        const known = KNOWN_MISMATCHES.has(`${c.fieldId}::${option}`);
        const run = known ? it.failing : it;
        run(`"${option}" → non-zero code${c.server ? ' → same wording back' : ''}${known ? ' [KNOWN MISMATCH]' : ''}`, () => {
          const code = c.normalizer(option);
          expect(code).not.toBe(0);
          if (c.server) expect(serverMap(c.server)(code)).toBe(option);
        });
      }

      it('distinct options get distinct codes', () => {
        const codes = options.map((o) => c.normalizer(o));
        expect(new Set(codes).size).toBe(options.length);
      });
    });
  }
});
