import { BadRequestException } from '@nestjs/common';
import {
  DEMAND_FORM_TYPES,
  buildOnefopExportWhere,
  buildSpssExportWhere,
  parseStatuses,
  resolveExportPartition,
} from './export-filters';

const ELIGIBLE = { status: 'APPROVED', anomalies: { none: { status: 'OPEN', isBlocking: true } } };

describe('ONEFOP export filters', () => {
  it('defaults to the official statistical base when no status is requested', () => {
    expect(buildOnefopExportWhere({}, ELIGIBLE)).toEqual(ELIGIBLE);
  });

  it('selects exactly the requested statuses, from a query string or an array', () => {
    expect(buildOnefopExportWhere({ statuses: 'PENDING_REVIEW,REJECTED' }, ELIGIBLE)).toEqual({
      status: { in: ['PENDING_REVIEW', 'REJECTED'] },
    });
    expect(parseStatuses(['DRAFT', 'APPROVED', 'CORRECTION_REQUESTED', 'APPROVED'])).toEqual([
      'DRAFT',
      'APPROVED',
      'CORRECTION_REQUESTED',
    ]);
  });

  it('rejects unknown statuses, entity types and years with a 400', () => {
    expect(() => parseStatuses('APPROVED,VALIDE')).toThrow(BadRequestException);
    expect(() => buildOnefopExportWhere({ entityType: 'SOCIETE' }, ELIGIBLE)).toThrow(BadRequestException);
    expect(() => buildOnefopExportWhere({ year: 'deux mille' }, ELIGIBLE)).toThrow(BadRequestException);
  });

  it('filters rows by entity type, place and year', () => {
    expect(
      buildOnefopExportWhere({ entityType: 'COOPERATIVE', region: 'Ouest', department: 'Mifi', year: '2026' }, ELIGIBLE),
    ).toMatchObject({ formType: 'COOPERATIVE', region: 'Ouest', department: 'Mifi', surveyYear: 2026 });
  });

  it('keeps demand and vocational-training rows in separate SPSS files', () => {
    expect(buildSpssExportWhere({}, ELIGIBLE).formType).toEqual({ in: DEMAND_FORM_TYPES });
    expect(DEMAND_FORM_TYPES).not.toContain('VOCATIONAL_TRAINING');
    expect(buildSpssExportWhere({ partition: 'TVET' }, ELIGIBLE).formType).toBe('VOCATIONAL_TRAINING');
    expect(buildSpssExportWhere({ entityType: 'VOCATIONAL_TRAINING' }, ELIGIBLE).formType).toBe('VOCATIONAL_TRAINING');
    expect(buildSpssExportWhere({ partition: 'ALL' }, ELIGIBLE).formType).toBeUndefined();
  });

  it('derives the variable partition from the entity type', () => {
    expect(resolveExportPartition({})).toBe('DEMAND');
    expect(resolveExportPartition({ entityType: 'VOCATIONAL_TRAINING' })).toBe('TVET');
    expect(resolveExportPartition({ entityType: 'ONG' })).toBe('DEMAND');
    expect(() => resolveExportPartition({ entityType: 'ONG', partition: 'TVET' })).toThrow(BadRequestException);
  });
});
