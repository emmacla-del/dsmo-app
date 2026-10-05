import { ForbiddenException } from '@nestjs/common';
import {
  assertTerritorialAuthority,
  territoryFromUser,
  territoryWhere,
  territoryWhereForDeclaration,
  territoryWhereForExport,
} from './territory';

const NO_ROWS = { id: { in: [] } };
const ieq = (value: string) => ({ equals: value, mode: 'insensitive' });

const LITTORAL = { region: 'Littoral', regionId: 'reg-lt', department: 'Wouri', departmentId: 'dep-wouri' };
const CENTRE = { region: 'Centre', regionId: 'reg-ce', department: 'Mfoundi', departmentId: 'dep-mfoundi' };

describe('territoryWhere', () => {
  it('applies no restriction to national roles', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN_ONEFOP']) {
      expect(territoryWhere({ role })).toEqual({});
      // A stray region on a national account must not narrow its scope.
      expect(territoryWhere({ role, region: 'Littoral', regionId: 'reg-lt' })).toEqual({});
    }
  });

  it('applies no restriction to internal calls with no territory', () => {
    expect(territoryWhere(undefined)).toEqual({});
    expect(territoryWhere(null)).toEqual({});
  });

  it('scopes REGIONAL by regionId, falling back to a case-insensitive region name', () => {
    expect(territoryWhere({ role: 'REGIONAL_ADMIN', regionId: 'reg-lt', region: 'Littoral' })).toEqual({ regionId: 'reg-lt' });
    expect(territoryWhere({ role: 'REGIONAL_ADMIN', region: 'Littoral' })).toEqual({ region: ieq('Littoral') });
    // The account's own casing is passed through; the DB comparison ignores case.
    expect(territoryWhere({ role: 'REGIONAL_ADMIN', region: 'CENTRE' })).toEqual({ region: ieq('CENTRE') });
    expect(territoryWhere({ role: 'REGIONAL_ADMIN', region: '  Centre ' })).toEqual({ region: ieq('Centre') });
  });

  it('fails closed for REGIONAL without a region', () => {
    expect(territoryWhere({ role: 'REGIONAL_ADMIN' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'REGIONAL_ADMIN', region: '   ' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'REGIONAL_ADMIN', department: 'Wouri' })).toEqual(NO_ROWS);
  });

  it('scopes DIVISIONAL by departmentId, else by region AND department names', () => {
    expect(territoryWhere({ role: 'DIVISIONAL_ADMIN', departmentId: 'dep-wouri', department: 'Wouri' })).toEqual({ departmentId: 'dep-wouri' });
    expect(territoryWhere({ role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' })).toEqual({
      region: ieq('Littoral'),
      department: ieq('Wouri'),
    });
  });

  it('fails closed for DIVISIONAL missing its region or its department', () => {
    expect(territoryWhere({ role: 'DIVISIONAL_ADMIN' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'DIVISIONAL_ADMIN', region: 'Littoral' })).toEqual(NO_ROWS);
    // Department alone no longer suffices: names repeat across regions.
    expect(territoryWhere({ role: 'DIVISIONAL_ADMIN', department: 'Wouri' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'DIVISIONAL_ADMIN', region: ' ', department: 'Wouri' })).toEqual(NO_ROWS);
  });

  it('fails closed for unknown or missing roles', () => {
    for (const role of ['AUDITOR', 'COMPANY', 'not-a-role']) {
      expect(territoryWhere({ role, region: 'Littoral' })).toEqual(NO_ROWS);
    }
    expect(territoryWhere({})).toEqual(NO_ROWS);
    expect(territoryWhere({ role: null, region: 'Littoral' })).toEqual(NO_ROWS);
    expect(territoryWhere(territoryFromUser(undefined))).toEqual(NO_ROWS);
  });
});

describe('assertTerritorialAuthority', () => {
  it('lets national roles act anywhere', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN_ONEFOP']) {
      expect(() => assertTerritorialAuthority({ role }, CENTRE)).not.toThrow();
    }
  });

  it('lets REGIONAL act in its region, by id or by case-insensitive name', () => {
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL_ADMIN', regionId: 'reg-lt' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL_ADMIN', region: 'Littoral' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL_ADMIN', region: 'LITTORAL' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL_ADMIN', region: 'CENTRE' }, { region: 'Centre' })).not.toThrow();
  });

  it('forbids REGIONAL outside its region with the audit message', () => {
    const actor = { role: 'REGIONAL_ADMIN', region: 'Littoral', regionId: 'reg-lt' };
    expect(() => assertTerritorialAuthority(actor, CENTRE)).toThrow(ForbiddenException);
    expect(() => assertTerritorialAuthority(actor, CENTRE)).toThrow(
      "Action non autorisée hors de votre région d'affectation (Littoral).",
    );
  });

  it('forbids REGIONAL without a region', () => {
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL_ADMIN' }, LITTORAL)).toThrow(ForbiddenException);
    // No match on undefined === undefined when neither side has an id.
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL_ADMIN' }, {})).toThrow(ForbiddenException);
  });

  it('lets DIVISIONAL act in its department, by id or by case-insensitive region AND department', () => {
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL_ADMIN', departmentId: 'dep-wouri' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL_ADMIN', region: 'LITTORAL', department: 'WOURI' }, LITTORAL)).not.toThrow();
  });

  it('keeps same-named departments in different regions apart (regression)', () => {
    const mayoA = { role: 'DIVISIONAL_ADMIN', region: 'Extrême-Nord', department: 'Mayo' };
    const mayoB = { role: 'DIVISIONAL_ADMIN', region: 'Nord', department: 'Mayo' };
    const dossierA = { region: 'Extrême-Nord', department: 'Mayo' };
    const dossierB = { region: 'Nord', department: 'Mayo' };
    expect(() => assertTerritorialAuthority(mayoA, dossierA)).not.toThrow();
    expect(() => assertTerritorialAuthority(mayoB, dossierB)).not.toThrow();
    expect(() => assertTerritorialAuthority(mayoA, dossierB)).toThrow(
      "Action non autorisée hors de votre département d'affectation (Mayo).",
    );
    expect(() => assertTerritorialAuthority(mayoB, dossierA)).toThrow(ForbiddenException);
    // The list filter carries both names, so the DB applies the same rule.
    expect(territoryWhere(mayoA)).toEqual({ region: ieq('Extrême-Nord'), department: ieq('Mayo') });
    expect(territoryWhere(mayoB)).toEqual({ region: ieq('Nord'), department: ieq('Mayo') });
  });

  it('forbids DIVISIONAL outside its department with the audit message', () => {
    const actor = { role: 'DIVISIONAL_ADMIN', department: 'Wouri', departmentId: 'dep-wouri' };
    expect(() => assertTerritorialAuthority(actor, CENTRE)).toThrow(
      "Action non autorisée hors de votre département d'affectation (Wouri).",
    );
  });

  it('forbids DIVISIONAL without a department or without a region', () => {
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL_ADMIN' }, LITTORAL)).toThrow(ForbiddenException);
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL_ADMIN', department: 'Wouri' }, LITTORAL)).toThrow(ForbiddenException);
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL_ADMIN', region: 'Littoral' }, LITTORAL)).toThrow(ForbiddenException);
    // Target rows missing a region are never matched by name.
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' }, { department: 'Wouri' }))
      .toThrow(ForbiddenException);
  });

  it('fails closed for unknown roles', () => {
    for (const role of ['AUDITOR', 'COMPANY', 'not-a-role']) {
      expect(() => assertTerritorialAuthority({ role, region: 'Littoral' }, LITTORAL)).toThrow(
        'Privilèges territoriaux insuffisants.',
      );
    }
  });

  it('fails closed with no role', () => {
    expect(() => assertTerritorialAuthority({}, LITTORAL)).toThrow('Authentification requise.');
    expect(() => assertTerritorialAuthority({ role: null, region: 'Littoral' }, LITTORAL)).toThrow(
      'Authentification requise.',
    );
    expect(() => assertTerritorialAuthority(territoryFromUser(undefined), LITTORAL)).toThrow(ForbiddenException);
  });
});

// D7 gave DATA_MANAGER and ANALYST read-only national scope on exports
// while territoryWhere kept failing closed for them and
// assertTerritorialAuthority refused them any write. The role collapse
// folded both into ADMIN_ONEFOP, which is national everywhere, so
// EXPORT_NATIONAL_ROLES and NATIONAL_ROLES now hold the same two values and
// that read-only/no-write distinction has no roles left to apply to. The
// three tests that asserted it were deleted rather than rewritten. What
// remains is the behaviour territoryWhereForExport still has of its own:
// national roles unscoped, territorial roles scoped exactly as
// territoryWhere scopes them, everything else closed.
describe('territoryWhereForExport', () => {
  const EXPORT_NATIONAL_ROLES = ['SUPER_ADMIN', 'ADMIN_ONEFOP'];

  it('gives the national roles unrestricted scope on exports', () => {
    for (const role of EXPORT_NATIONAL_ROLES) {
      expect(territoryWhereForExport({ role })).toEqual({});
      // A stray region on the account must not narrow its export scope.
      expect(territoryWhereForExport({ role, region: 'Littoral', regionId: 'reg-lt' })).toEqual({});
    }
  });

  it('still scopes REGIONAL and DIVISIONAL exactly like territoryWhere', () => {
    const scoped = [
      { role: 'REGIONAL_ADMIN', regionId: 'reg-lt', region: 'Littoral' },
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
      { role: 'DIVISIONAL_ADMIN', departmentId: 'dep-wouri', department: 'Wouri' },
      { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' },
    ];
    for (const territory of scoped) {
      expect(territoryWhereForExport(territory)).toEqual(territoryWhere(territory));
      expect(territoryWhereForExport(territory)).not.toEqual({});
    }
    expect(territoryWhereForExport({ role: 'REGIONAL_ADMIN', region: 'Littoral' })).toEqual({ region: ieq('Littoral') });
    expect(territoryWhereForExport({ role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' })).toEqual({
      region: ieq('Littoral'),
      department: ieq('Wouri'),
    });
  });

  it('still fails closed for unassigned territorial accounts and other roles', () => {
    expect(territoryWhereForExport({ role: 'REGIONAL_ADMIN' })).toEqual(NO_ROWS);
    expect(territoryWhereForExport({ role: 'DIVISIONAL_ADMIN', department: 'Wouri' })).toEqual(NO_ROWS);
    for (const role of ['AUDITOR', 'COMPANY', 'not-a-role']) {
      expect(territoryWhereForExport({ role, region: 'Littoral' })).toEqual(NO_ROWS);
    }
    expect(territoryWhereForExport({})).toEqual(NO_ROWS);
    expect(territoryWhereForExport(territoryFromUser(undefined))).toEqual(NO_ROWS);
  });

  it('applies no restriction to internal calls with no territory', () => {
    expect(territoryWhereForExport(undefined)).toEqual({});
    expect(territoryWhereForExport(null)).toEqual({});
  });
});

// Declaration has neither regionId nor departmentId, and names the second
// administrative tier `division`. territoryWhereForDeclaration exists so the
// where handed to a declaration query only ever mentions columns that model
// actually declares — the id branches of territoryWhere would make Prisma
// throw at runtime.
describe('territoryWhereForDeclaration', () => {
  it('emits no column Declaration does not declare, for every territory shape', () => {
    const shapes = [
      { role: 'SUPER_ADMIN' },
      { role: 'ADMIN_ONEFOP' },
      { role: 'REGIONAL_ADMIN', ...LITTORAL },
      { role: 'REGIONAL_ADMIN', region: 'Centre' },
      { role: 'REGIONAL_ADMIN', regionId: 'reg-lt' },
      { role: 'DIVISIONAL_ADMIN', ...CENTRE },
      { role: 'DIVISIONAL_ADMIN', departmentId: 'dep-wouri' },
      { role: 'AUDITOR', region: 'Littoral' },
      {},
    ];
    for (const shape of shapes) {
      const keys = Object.keys(territoryWhereForDeclaration(shape));
      expect(keys.sort()).toEqual(keys.filter((k) => ['id', 'region', 'division'].includes(k)).sort());
    }
  });

  it('scopes REGIONAL by region name only — never by regionId', () => {
    expect(territoryWhereForDeclaration({ role: 'REGIONAL_ADMIN', region: 'Littoral' })).toEqual({ region: ieq('Littoral') });
    // regionId present alongside the name must not change the emitted shape.
    expect(territoryWhereForDeclaration({ role: 'REGIONAL_ADMIN', regionId: 'reg-lt', region: 'Littoral' })).toEqual({
      region: ieq('Littoral'),
    });
    // regionId alone cannot be translated to a Declaration column: fail closed.
    expect(territoryWhereForDeclaration({ role: 'REGIONAL_ADMIN', regionId: 'reg-lt' })).toEqual(NO_ROWS);
  });

  it('scopes DIVISIONAL by region AND division, never by department or departmentId', () => {
    expect(territoryWhereForDeclaration({ role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' })).toEqual({
      region: ieq('Littoral'),
      division: ieq('Wouri'),
    });
    // departmentId alone fails closed rather than reading nationally.
    expect(territoryWhereForDeclaration({ role: 'DIVISIONAL_ADMIN', departmentId: 'dep-wouri' })).toEqual(NO_ROWS);
    // Division names repeat across regions, so a division alone is not enough.
    expect(territoryWhereForDeclaration({ role: 'DIVISIONAL_ADMIN', department: 'Wouri' })).toEqual(NO_ROWS);
  });

  it('matches territoryWhere on the national and no-territory cases, and fails closed elsewhere', () => {
    expect(territoryWhereForDeclaration(undefined)).toEqual({});
    expect(territoryWhereForDeclaration(null)).toEqual({});
    for (const role of ['SUPER_ADMIN', 'ADMIN_ONEFOP']) {
      expect(territoryWhereForDeclaration({ role })).toEqual({});
      expect(territoryWhereForDeclaration({ role, region: 'Littoral', regionId: 'reg-lt' })).toEqual({});
    }
    for (const role of ['AUDITOR', 'COMPANY', 'not-a-role']) {
      expect(territoryWhereForDeclaration({ role, region: 'Littoral' })).toEqual(NO_ROWS);
    }
    expect(territoryWhereForDeclaration({})).toEqual(NO_ROWS);
    expect(territoryWhereForDeclaration(territoryFromUser(undefined))).toEqual(NO_ROWS);
  });
});

describe('territoryFromUser', () => {
  it('copies the jurisdiction fields from req.user', () => {
    expect(territoryFromUser({ id: 'u1', email: 'a@b.cm', role: 'REGIONAL_ADMIN', region: 'Littoral', department: null })).toEqual({
      role: 'REGIONAL_ADMIN',
      region: 'Littoral',
      department: null,
      regionId: null,
      departmentId: null,
    });
  });
});
