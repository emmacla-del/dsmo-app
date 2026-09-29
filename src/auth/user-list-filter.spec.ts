import { BadRequestException } from '@nestjs/common';
import { buildUserListWhere } from './user-list-filter';

describe('buildUserListWhere', () => {
  it('excludes COMPANY accounts by default', () => {
    expect(buildUserListWhere({}).role).toEqual({ not: 'COMPANY' });
  });

  it('keeps the legacy single-role filter', () => {
    expect(buildUserListWhere({ role: 'REGIONAL' }).role).toEqual({ in: ['REGIONAL'] });
  });

  it('accepts a comma-separated role list', () => {
    expect(buildUserListWhere({ roles: 'REGIONAL, DIVISIONAL' }).role).toEqual({
      in: ['REGIONAL', 'DIVISIONAL'],
    });
  });

  it('intersects role and roles instead of widening', () => {
    expect(buildUserListWhere({ roles: 'REGIONAL,DIVISIONAL', role: 'CENTRAL' }).role).toEqual({
      in: [],
    });
    expect(buildUserListWhere({ roles: 'REGIONAL,DIVISIONAL', role: 'REGIONAL' }).role).toEqual({
      in: ['REGIONAL'],
    });
  });

  it('never lists COMPANY accounts even when asked explicitly', () => {
    expect(buildUserListWhere({ role: 'COMPANY' }).role).toEqual({ in: [] });
    expect(buildUserListWhere({ roles: 'COMPANY,CENTRAL' }).role).toEqual({ in: ['CENTRAL'] });
  });

  it('rejects unknown roles with a 400', () => {
    expect(() => buildUserListWhere({ roles: 'REGIONAL,HACKER' })).toThrow(BadRequestException);
    expect(() => buildUserListWhere({ role: 'nope' })).toThrow(BadRequestException);
  });

  it('filters by region case-insensitively', () => {
    expect(buildUserListWhere({ region: ' Littoral ' }).region).toEqual({
      equals: 'Littoral',
      mode: 'insensitive',
    });
    expect(buildUserListWhere({ region: '  ' }).region).toBeUndefined();
  });

  it('keeps status, isActive and search behaviour', () => {
    const where = buildUserListWhere({ status: 'PENDING_APPROVAL', isActive: 'false', search: ' ewane ' });
    expect(where.status).toBe('PENDING_APPROVAL');
    expect(where.isActive).toBe(false);
    expect(where.OR).toHaveLength(5);
    expect(where.OR[0]).toEqual({ email: { contains: 'ewane', mode: 'insensitive' } });
  });
});
