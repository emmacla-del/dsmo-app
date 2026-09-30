import { ForbiddenException } from '@nestjs/common';
import { assertTerritorialAuthority, territoryFromUser, territoryWhere, territoryWhereForExport } from './territory';

const NO_ROWS = { id: { in: [] } };
const ieq = (value: string) => ({ equals: value, mode: 'insensitive' });

const LITTORAL = { region: 'Littoral', regionId: 'reg-lt', department: 'Wouri', departmentId: 'dep-wouri' };
const CENTRE = { region: 'Centre', regionId: 'reg-ce', department: 'Mfoundi', departmentId: 'dep-mfoundi' };

describe('territoryWhere', () => {
  it('applies no restriction to national roles', () => {
    for (const role of ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'CENTRAL']) {
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
    expect(territoryWhere({ role: 'REGIONAL', regionId: 'reg-lt', region: 'Littoral' })).toEqual({ regionId: 'reg-lt' });
    expect(territoryWhere({ role: 'REGIONAL', region: 'Littoral' })).toEqual({ region: ieq('Littoral') });
    // The account's own casing is passed through; the DB comparison ignores case.
    expect(territoryWhere({ role: 'REGIONAL', region: 'CENTRE' })).toEqual({ region: ieq('CENTRE') });
    expect(territoryWhere({ role: 'REGIONAL', region: '  Centre ' })).toEqual({ region: ieq('Centre') });
  });

  it('fails closed for REGIONAL without a region', () => {
    expect(territoryWhere({ role: 'REGIONAL' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'REGIONAL', region: '   ' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'REGIONAL', department: 'Wouri' })).toEqual(NO_ROWS);
  });

  it('scopes DIVISIONAL by departmentId, else by region AND department names', () => {
    expect(territoryWhere({ role: 'DIVISIONAL', departmentId: 'dep-wouri', department: 'Wouri' })).toEqual({ departmentId: 'dep-wouri' });
    expect(territoryWhere({ role: 'DIVISIONAL', region: 'Littoral', department: 'Wouri' })).toEqual({
      region: ieq('Littoral'),
      department: ieq('Wouri'),
    });
  });

  it('fails closed for DIVISIONAL missing its region or its department', () => {
    expect(territoryWhere({ role: 'DIVISIONAL' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'DIVISIONAL', region: 'Littoral' })).toEqual(NO_ROWS);
    // Department alone no longer suffices: names repeat across regions.
    expect(territoryWhere({ role: 'DIVISIONAL', department: 'Wouri' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'DIVISIONAL', region: ' ', department: 'Wouri' })).toEqual(NO_ROWS);
  });

  it('fails closed for unknown or missing roles', () => {
    for (const role of ['ANALYST', 'AUDITOR', 'COMPANY', 'SUPER_ADMIN_DSMO', 'not-a-role']) {
      expect(territoryWhere({ role, region: 'Littoral' })).toEqual(NO_ROWS);
    }
    expect(territoryWhere({})).toEqual(NO_ROWS);
    expect(territoryWhere({ role: null, region: 'Littoral' })).toEqual(NO_ROWS);
    expect(territoryWhere(territoryFromUser(undefined))).toEqual(NO_ROWS);
  });
});

describe('assertTerritorialAuthority', () => {
  it('lets national roles act anywhere', () => {
    for (const role of ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'CENTRAL']) {
      expect(() => assertTerritorialAuthority({ role }, CENTRE)).not.toThrow();
    }
  });

  it('lets REGIONAL act in its region, by id or by case-insensitive name', () => {
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL', regionId: 'reg-lt' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL', region: 'Littoral' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL', region: 'LITTORAL' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL', region: 'CENTRE' }, { region: 'Centre' })).not.toThrow();
  });

  it('forbids REGIONAL outside its region with the audit message', () => {
    const actor = { role: 'REGIONAL', region: 'Littoral', regionId: 'reg-lt' };
    expect(() => assertTerritorialAuthority(actor, CENTRE)).toThrow(ForbiddenException);
    expect(() => assertTerritorialAuthority(actor, CENTRE)).toThrow(
      "Action non autorisée hors de votre région d'affectation (Littoral).",
    );
  });

  it('forbids REGIONAL without a region', () => {
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL' }, LITTORAL)).toThrow(ForbiddenException);
    // No match on undefined === undefined when neither side has an id.
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL' }, {})).toThrow(ForbiddenException);
  });

  it('lets DIVISIONAL act in its department, by id or by case-insensitive region AND department', () => {
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', departmentId: 'dep-wouri' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', region: 'Littoral', department: 'Wouri' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', region: 'LITTORAL', department: 'WOURI' }, LITTORAL)).not.toThrow();
  });

  it('keeps same-named departments in different regions apart (regression)', () => {
    const mayoA = { role: 'DIVISIONAL', region: 'Extrême-Nord', department: 'Mayo' };
    const mayoB = { role: 'DIVISIONAL', region: 'Nord', department: 'Mayo' };
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
    const actor = { role: 'DIVISIONAL', department: 'Wouri', departmentId: 'dep-wouri' };
    expect(() => assertTerritorialAuthority(actor, CENTRE)).toThrow(
      "Action non autorisée hors de votre département d'affectation (Wouri).",
    );
  });

  it('forbids DIVISIONAL without a department or without a region', () => {
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL' }, LITTORAL)).toThrow(ForbiddenException);
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', department: 'Wouri' }, LITTORAL)).toThrow(ForbiddenException);
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', region: 'Littoral' }, LITTORAL)).toThrow(ForbiddenException);
    // Target rows missing a region are never matched by name.
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', region: 'Littoral', department: 'Wouri' }, { department: 'Wouri' }))
      .toThrow(ForbiddenException);
  });

  it('fails closed for unknown roles', () => {
    for (const role of ['ANALYST', 'AUDITOR', 'COMPANY', 'not-a-role']) {
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

describe('territoryWhereForExport (D7)', () => {
  const D7_ROLES = ['SUPER_ADMIN_DSMO', 'DATA_MANAGER', 'ANALYST'];

  it('gives the D7 roles national scope on exports', () => {
    for (const role of D7_ROLES) {
      expect(territoryWhereForExport({ role })).toEqual({});
      // A stray region on the account must not narrow its export scope.
      expect(territoryWhereForExport({ role, region: 'Littoral', regionId: 'reg-lt' })).toEqual({});
    }
  });

  it('keeps the existing national roles national on exports', () => {
    for (const role of ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'CENTRAL']) {
      expect(territoryWhereForExport({ role, region: 'Littoral' })).toEqual({});
    }
  });

  it('leaves the general territoryWhere failing closed for the D7 roles', () => {
    for (const role of D7_ROLES) {
      expect(territoryWhere({ role })).toEqual(NO_ROWS);
      expect(territoryWhere({ role, region: 'Littoral', regionId: 'reg-lt' })).toEqual(NO_ROWS);
    }
  });

  it('grants the D7 roles no write scope: assertTerritorialAuthority still refuses them', () => {
    for (const role of D7_ROLES) {
      expect(() => assertTerritorialAuthority({ role, region: 'Littoral', regionId: 'reg-lt' }, CENTRE)).toThrow(
        'Privilèges territoriaux insuffisants.',
      );
    }
  });

  it('still scopes REGIONAL and DIVISIONAL exactly like territoryWhere', () => {
    const scoped = [
      { role: 'REGIONAL', regionId: 'reg-lt', region: 'Littoral' },
      { role: 'REGIONAL', region: 'Littoral' },
      { role: 'DIVISIONAL', departmentId: 'dep-wouri', department: 'Wouri' },
      { role: 'DIVISIONAL', region: 'Littoral', department: 'Wouri' },
    ];
    for (const territory of scoped) {
      expect(territoryWhereForExport(territory)).toEqual(territoryWhere(territory));
      expect(territoryWhereForExport(territory)).not.toEqual({});
    }
    expect(territoryWhereForExport({ role: 'REGIONAL', region: 'Littoral' })).toEqual({ region: ieq('Littoral') });
    expect(territoryWhereForExport({ role: 'DIVISIONAL', region: 'Littoral', department: 'Wouri' })).toEqual({
      region: ieq('Littoral'),
      department: ieq('Wouri'),
    });
  });

  it('still fails closed for unassigned territorial accounts and other roles', () => {
    expect(territoryWhereForExport({ role: 'REGIONAL' })).toEqual(NO_ROWS);
    expect(territoryWhereForExport({ role: 'DIVISIONAL', department: 'Wouri' })).toEqual(NO_ROWS);
    for (const role of ['AUDITOR', 'CAMPAIGN_MANAGER', 'COMPANY', 'not-a-role']) {
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

describe('territoryFromUser', () => {
  it('copies the jurisdiction fields from req.user', () => {
    expect(territoryFromUser({ id: 'u1', email: 'a@b.cm', role: 'REGIONAL', region: 'Littoral', department: null })).toEqual({
      role: 'REGIONAL',
      region: 'Littoral',
      department: null,
      regionId: null,
      departmentId: null,
    });
  });
});
