import { ForbiddenException } from '@nestjs/common';
import { assertTerritorialAuthority, territoryFromUser, territoryWhere } from './territory';

const NO_ROWS = { id: { in: [] } };

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

  it('scopes REGIONAL by regionId, falling back to the region name', () => {
    expect(territoryWhere({ role: 'REGIONAL', regionId: 'reg-lt', region: 'Littoral' })).toEqual({ regionId: 'reg-lt' });
    expect(territoryWhere({ role: 'REGIONAL', region: 'Littoral' })).toEqual({ region: 'Littoral' });
  });

  it('fails closed for REGIONAL without a region', () => {
    expect(territoryWhere({ role: 'REGIONAL' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'REGIONAL', department: 'Wouri' })).toEqual(NO_ROWS);
  });

  it('scopes DIVISIONAL by departmentId, falling back to the department name', () => {
    expect(territoryWhere({ role: 'DIVISIONAL', departmentId: 'dep-wouri', department: 'Wouri' })).toEqual({ departmentId: 'dep-wouri' });
    expect(territoryWhere({ role: 'DIVISIONAL', department: 'Wouri' })).toEqual({ department: 'Wouri' });
  });

  it('fails closed for DIVISIONAL without a department', () => {
    expect(territoryWhere({ role: 'DIVISIONAL' })).toEqual(NO_ROWS);
    expect(territoryWhere({ role: 'DIVISIONAL', region: 'Littoral' })).toEqual(NO_ROWS);
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

  it('lets REGIONAL act in its region, by id or by name', () => {
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL', regionId: 'reg-lt' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'REGIONAL', region: 'Littoral' }, LITTORAL)).not.toThrow();
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

  it('lets DIVISIONAL act in its department, by id or by name', () => {
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', departmentId: 'dep-wouri' }, LITTORAL)).not.toThrow();
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL', department: 'Wouri' }, LITTORAL)).not.toThrow();
  });

  it('forbids DIVISIONAL outside its department with the audit message', () => {
    const actor = { role: 'DIVISIONAL', department: 'Wouri', departmentId: 'dep-wouri' };
    expect(() => assertTerritorialAuthority(actor, CENTRE)).toThrow(
      "Action non autorisée hors de votre département d'affectation (Wouri).",
    );
  });

  it('forbids DIVISIONAL without a department', () => {
    expect(() => assertTerritorialAuthority({ role: 'DIVISIONAL' }, LITTORAL)).toThrow(ForbiddenException);
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
