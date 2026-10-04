import { BadRequestException } from '@nestjs/common';
import { buildAuditLogWhere, parseAuditLogFilters, parseIntParam } from './audit-log-filter';

describe('parseAuditLogFilters', () => {
  it('returns no filters for an empty query (legacy callers)', () => {
    expect(parseAuditLogFilters({})).toEqual({
      period: undefined,
      actor: undefined,
      action: undefined,
      resourceType: undefined,
      resourceId: undefined,
    });
  });

  it('trims text and drops blanks', () => {
    const f = parseAuditLogFilters({ actor: '  Ewane ', action: '   ', resourceId: 'ENT-1' });
    expect(f.actor).toBe('Ewane');
    expect(f.action).toBeUndefined();
    expect(f.resourceId).toBe('ENT-1');
  });

  it('caps free text at 100 characters', () => {
    expect(parseAuditLogFilters({ actor: 'x'.repeat(500) }).actor).toHaveLength(100);
  });

  it('accepts the dossier-list periods', () => {
    expect(parseAuditLogFilters({ period: '7d' }).period).toBe('7d');
    expect(parseAuditLogFilters({ period: '12m' }).period).toBe('12m');
  });

  it('rejects an unknown period with 400', () => {
    expect(() => parseAuditLogFilters({ period: '2d' })).toThrow(BadRequestException);
  });

  it('ignores non-string values', () => {
    expect(parseAuditLogFilters({ actor: ['a', 'b'] }).actor).toBeUndefined();
  });
});

describe('buildAuditLogWhere', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('selects every row when no filter is set', () => {
    expect(buildAuditLogWhere({}, now)).toEqual({ AND: [] });
  });

  it('combines every filter with AND', () => {
    const where = buildAuditLogWhere(
      { period: '7d', action: 'AUDIT_REJECT', resourceType: 'OnefopSubmission', resourceId: 'abc', actor: 'user-7' },
      now,
    );
    expect(where.AND).toEqual([
      { timestamp: { gte: new Date('2026-09-23T12:00:00Z') } },
      { action: 'AUDIT_REJECT' },
      { resourceType: 'OnefopSubmission' },
      { resourceId: { contains: 'abc', mode: 'insensitive' } },
      { userId: { equals: 'user-7' } },
    ]);
  });

  it('matches the actor exactly, never as a substring of a name or email', () => {
    const [clause] = buildAuditLogWhere({ actor: 'user-7' }, now).AND;
    expect(clause).toEqual({ userId: { equals: 'user-7' } });
    expect(JSON.stringify(clause)).not.toContain('contains');
  });
});

describe('parseIntParam', () => {
  it('falls back when absent', () => {
    expect(parseIntParam(undefined, 20, 1, 100, 'm')).toBe(20);
  });

  it('rejects non-integers and out-of-range values', () => {
    expect(() => parseIntParam('abc', 20, 1, 100, 'm')).toThrow(BadRequestException);
    expect(() => parseIntParam('0', 20, 1, 100, 'm')).toThrow(BadRequestException);
    expect(() => parseIntParam('101', 20, 1, 100, 'm')).toThrow(BadRequestException);
  });
});
