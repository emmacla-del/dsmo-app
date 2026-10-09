import { AnomalySeverity, AnomalyStatus } from '@prisma/client';
import { coherenceFlagToAnomaly } from './coherence-anomaly';

describe('coherenceFlagToAnomaly', () => {
  it.each([
    'VT_TRAINEE_SPECIALTY_TOTAL_MISMATCH',
    'VT_TRAINER_STATUS_MISMATCH',
    'S22Q03_DIPLOMA_MISMATCH',
    'S3_DISMISSAL_MISMATCH',
    'S22Q04_PERMANENT_EXCEEDS_TOTAL',
    'PERMANENT_WORKERS_IMPLAUSIBLE',
    'SOMETHING_BLOCKING',
  ])('stores %s as an open, non-blocking warning', (code) => {
    const anomaly = coherenceFlagToAnomaly('sub-1', { code, message: 'm' });
    expect(anomaly.isBlocking).toBe(false);
    expect(anomaly.severity).toBe(AnomalySeverity.WARNING);
    expect(anomaly.status).toBe(AnomalyStatus.OPEN);
  });

  it('keeps the rule code, family and message', () => {
    expect(coherenceFlagToAnomaly('sub-1', { code: 'VT_TRAINER_AGE_MISMATCH', message: 'Écart 8.2/8.3' })).toMatchObject({
      submissionId: 'sub-1',
      ruleCode: 'VT_TRAINER_AGE_MISMATCH',
      ruleFamily: 'VT_COHERENCE',
      description: 'Écart 8.2/8.3',
    });
    expect(coherenceFlagToAnomaly('sub-2', { code: 'S3_DISMISSAL_MISMATCH' }).ruleFamily).toBe('COHERENCE');
  });

  it('a legacy flag without code or message still gets a readable anomaly', () => {
    expect(coherenceFlagToAnomaly('sub-3', {})).toMatchObject({
      ruleCode: 'COHERENCE_MISMATCH',
      ruleFamily: 'COHERENCE',
      description: 'Incohérence statistique détectée',
      isBlocking: false,
    });
  });
});
