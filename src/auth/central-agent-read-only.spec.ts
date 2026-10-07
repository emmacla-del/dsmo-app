import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CENTRAL_AGENT is national READ-ONLY staff (staff-scope.ts
 * READ_ONLY_NATIONAL_ROLES). Nothing but the @Roles lists keeps it off the
 * mutations, so this walks every controller in src/ and checks each handler
 * the role can reach:
 *
 *  - it is a GET, and
 *  - it is not an export (statistical exports were excluded from the role).
 *
 * The effective roles of a handler are its own @Roles, or the class's when
 * it has none -- the RolesGuard's getAllAndOverride rule -- so a class-level
 * grant is caught on every handler it would reach, mutations included.
 */

const ROLE = 'CENTRAL_AGENT';

function controllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...controllerFiles(full));
    else if (name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

interface Handler {
  route: string;
  method: RequestMethod;
  roles: string[];
}

function handlers(): Handler[] {
  const out: Handler[] = [];
  for (const file of controllerFiles(path.join(__dirname, '..'))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file);
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      const base = Reflect.getMetadata(PATH_METADATA, exported);
      if (base === undefined) continue; // not a controller
      const classRoles: string[] | undefined = Reflect.getMetadata('roles', exported);
      const proto = (exported as any).prototype;
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        const fn = proto[key];
        const method = Reflect.getMetadata(METHOD_METADATA, fn);
        if (method === undefined) continue; // not a route handler
        const sub = Reflect.getMetadata(PATH_METADATA, fn);
        const methodRoles: string[] | undefined = Reflect.getMetadata('roles', fn);
        out.push({
          route: `${[].concat(base).join('|')}/${[].concat(sub ?? '').join('|')}`.replace(/\/+$/, ''),
          method,
          roles: methodRoles ?? classRoles ?? [],
        });
      }
    }
  }
  return out;
}

describe('CENTRAL_AGENT is read-only', () => {
  const all = handlers();
  const reachable = all.filter((h) => h.roles.includes(ROLE));

  it('found the controllers', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('reaches GET handlers only', () => {
    const writes = reachable.filter((h) => h.method !== RequestMethod.GET).map((h) => `${RequestMethod[h.method]} ${h.route}`);
    expect(writes).toEqual([]);
  });

  it('reaches no export', () => {
    expect(reachable.filter((h) => /export/i.test(h.route)).map((h) => h.route)).toEqual([]);
  });

  it.each([
    'admin/pilotage/coverage',
    'admin/questionnaires',
    'admin/questionnaires/:id',
    'companies',
    'companies/stats',
    'onefop/submissions/:id',
    'data-management/stats',
  ])('can read %s', (route) => {
    expect(reachable.map((h) => h.route)).toContain(route);
  });

  it.each([
    'admin/questionnaires/:id/approve',
    'admin/questionnaires/bulk-visa',
    'admin/questionnaires/export',
    'auth/users',
    'auth/admin/staff-invitations',
    'campaigns',
  ])('cannot reach %s', (route) => {
    expect(reachable.map((h) => h.route)).not.toContain(route);
  });
});
