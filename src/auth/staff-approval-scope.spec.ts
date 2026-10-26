import { ForbiddenException } from '@nestjs/common';
import { assertCanApproveRegistration, staffApprovalScope } from './staff-scope';
import { assertTerritorialAuthority } from './territory';

/**
 * Who may approve a pending STAFF account, as the owner's matrix of
 * 2026-10-26 states it:
 *
 *   staff, regional territory    -> regional délégué      | national
 *   staff, divisional territory  -> divisional délégué     | regional délégué -> national
 *
 * A non-delegate territorial admin approves ENTITY accounts only (the
 * company path, assertTerritorialAuthority, untouched here) and no staff
 * account at all. National is the fallback at every tier.
 */

const REGIONAL_DELEGATE = {
  role: 'REGIONAL_ADMIN',
  positionType: 'DELEGUE_REGIONAL',
  region: 'Centre',
  department: null,
};
const DIVISIONAL_DELEGATE = {
  role: 'DIVISIONAL_ADMIN',
  positionType: 'DELEGUE_DEPARTEMENTAL',
  region: 'Centre',
  department: 'Mfoundi',
};
// Same role as the délégué, a different post: a regional technical secretary.
const REGIONAL_CADRE = {
  role: 'REGIONAL_ADMIN',
  positionType: 'CHEF_SERVICE',
  region: 'Centre',
  department: null,
};
const SUPER = { role: 'SUPER_ADMIN' };
const ONEFOP = { role: 'ADMIN_ONEFOP' };

const regionalStaff = (region = 'Centre') => ({ role: 'REGIONAL_ADMIN', region, department: null });
const divisionalStaff = (region = 'Centre', department = 'Mfoundi') => ({ role: 'DIVISIONAL_ADMIN', region, department });

function refuses(actor: any, target: any) {
  expect(() => assertCanApproveRegistration(actor, target)).toThrow(ForbiddenException);
}
function allows(actor: any, target: any) {
  expect(() => assertCanApproveRegistration(actor, target)).not.toThrow();
}

describe('staffApprovalScope', () => {
  it('is the délégué of a territory, never another holder of the same role', () => {
    expect(staffApprovalScope(REGIONAL_DELEGATE)).toEqual({
      roles: ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN'],
      region: 'Centre',
    });
    expect(staffApprovalScope(DIVISIONAL_DELEGATE)).toEqual({
      roles: ['DIVISIONAL_ADMIN'],
      region: 'Centre',
      department: 'Mfoundi',
    });
    // The post is what tells a délégué from their own cadres, who hold the
    // same role.
    expect(staffApprovalScope(REGIONAL_CADRE)).toBeNull();
    expect(staffApprovalScope({ ...DIVISIONAL_DELEGATE, positionType: 'STAFF' })).toBeNull();
  });

  it('gives nothing to the national roles, to a reader, or to nobody', () => {
    // National authority comes from manageableRolesFor, not from a territory.
    expect(staffApprovalScope(SUPER)).toBeNull();
    expect(staffApprovalScope(ONEFOP)).toBeNull();
    expect(staffApprovalScope({ role: 'CENTRAL_AGENT', positionType: 'DELEGUE_REGIONAL', region: 'Centre' })).toBeNull();
    expect(staffApprovalScope(undefined)).toBeNull();
    expect(staffApprovalScope({})).toBeNull();
  });

  it('fails closed for a delegate whose own account carries no territory', () => {
    expect(staffApprovalScope({ ...REGIONAL_DELEGATE, region: null })).toBeNull();
    expect(staffApprovalScope({ ...REGIONAL_DELEGATE, region: '   ' })).toBeNull();
    expect(staffApprovalScope({ ...DIVISIONAL_DELEGATE, department: null })).toBeNull();
  });
});

describe('assertCanApproveRegistration — the regional délégué', () => {
  it('approves the staff of their region, and the divisional staff inside it', () => {
    allows(REGIONAL_DELEGATE, regionalStaff());
    // Containment: the divisional delegate, and their staff, sit in the
    // region. This is also what lets a division's FIRST delegate be
    // approved by someone other than the post being filled.
    allows(REGIONAL_DELEGATE, divisionalStaff('Centre', 'Mfoundi'));
    allows(REGIONAL_DELEGATE, divisionalStaff('Centre', 'Mefou-et-Afamba'));
  });

  it('approves nothing outside their region', () => {
    refuses(REGIONAL_DELEGATE, regionalStaff('Littoral'));
    refuses(REGIONAL_DELEGATE, divisionalStaff('Littoral', 'Wouri'));
  });

  it('approves no national account, whatever the territory', () => {
    for (const role of ['CENTRAL_AGENT', 'ADMIN_ONEFOP', 'ADMIN_ONEFOP_REGISTRATIONS', 'AUDITOR', 'SUPER_ADMIN']) {
      refuses(REGIONAL_DELEGATE, { role, region: 'Centre', department: null });
    }
  });
});

describe('assertCanApproveRegistration — the divisional délégué', () => {
  it('approves their own division and nothing wider', () => {
    allows(DIVISIONAL_DELEGATE, divisionalStaff('Centre', 'Mfoundi'));
    refuses(DIVISIONAL_DELEGATE, divisionalStaff('Centre', 'Mefou-et-Afamba'));
    refuses(DIVISIONAL_DELEGATE, divisionalStaff('Littoral', 'Wouri'));
    // The region is above them: a REGIONAL_ADMIN account is not theirs to open.
    refuses(DIVISIONAL_DELEGATE, regionalStaff('Centre'));
  });
});

describe('assertCanApproveRegistration — everyone else', () => {
  it('refuses a non-delegate territorial admin every staff account', () => {
    refuses(REGIONAL_CADRE, regionalStaff());
    refuses(REGIONAL_CADRE, divisionalStaff());
    refuses({ ...DIVISIONAL_DELEGATE, positionType: 'CHEF_SERVICE' }, divisionalStaff());
    // Their authority is over ENTITY accounts in their territory, which is
    // the company path and is not reached through this guard at all.
  });

  it('refuses a read-only agent and an unauthenticated actor', () => {
    refuses({ role: 'CENTRAL_AGENT', region: 'Centre' }, regionalStaff());
    refuses({}, regionalStaff());
    refuses(undefined, regionalStaff());
  });

  it('leaves the ENTITY path on role and territory, never on the post', () => {
    // Rows three and four of the matrix: for an entity account the délégué
    // and a non-delegate admin of the same territory both suffice, whichever
    // acts first. That is the company path (D3), which asks only where the
    // actor serves -- pinned here so that unifying the two guards cannot
    // quietly start demanding the délégué's post for a company file.
    const company = { region: 'Centre', department: 'Mfoundi' };
    expect(() => assertTerritorialAuthority(REGIONAL_CADRE, company)).not.toThrow();
    expect(() => assertTerritorialAuthority(REGIONAL_DELEGATE, company)).not.toThrow();
    const divisionalCadre = { ...DIVISIONAL_DELEGATE, positionType: 'CHEF_SERVICE' };
    expect(() => assertTerritorialAuthority(divisionalCadre, company)).not.toThrow();
    expect(() => assertTerritorialAuthority(divisionalCadre, { region: 'Centre', department: 'Mefou-et-Afamba' }))
      .toThrow(ForbiddenException);
    expect(() => assertTerritorialAuthority(REGIONAL_CADRE, { region: 'Littoral', department: 'Wouri' }))
      .toThrow(ForbiddenException);
  });

  it('keeps national as the fallback at every tier', () => {
    allows(SUPER, regionalStaff('Littoral'));
    allows(SUPER, divisionalStaff('Extrême-Nord', 'Diamaré'));
    allows(SUPER, { role: 'ADMIN_ONEFOP' });
    // ADMIN_ONEFOP manages the staff roles, anywhere, and not its own rank.
    allows(ONEFOP, regionalStaff('Littoral'));
    allows(ONEFOP, divisionalStaff('Extrême-Nord', 'Diamaré'));
    allows(ONEFOP, { role: 'CENTRAL_AGENT' });
    refuses(ONEFOP, { role: 'SUPER_ADMIN' });
  });
});
