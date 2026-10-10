import { spawnSync } from 'child_process';
import * as path from 'path';
import { mapEnterpriseData, mapVocationalTrainingData } from './pdf-data-mapper.service';

// The official PDF's data-collection period ({{collectionPeriod}} in
// src/pdf/templates/dynamic/*.hbs) is the Cameroon calendar period of the
// round's code, whatever zone the server runs in. The round
// QUARTERLY_2026_T4_001 is stored from 2026-09-30T23:00:00Z (midnight
// Douala); the PDF must print 01/10/2026, never 30/09/2026, and its last
// day 31/12/2026.
describe('PDF collection period is the Douala calendar period', () => {
  it('in this process', () => {
    const fr = mapEnterpriseData({}, 'QUARTERLY_2026_T4_001', 'fr');
    expect(fr.collectionPeriod).toBe('01/10/2026 au 31/12/2026');
    expect(fr.collectionPeriodFr).toBe('01/10/2026 au 31/12/2026');
    expect(fr.collectionPeriodEn).toBe('01/10/2026 to 31/12/2026');
    expect(mapVocationalTrainingData({}, 'QUARTERLY_2026_T4_001', 'en').collectionPeriod).toBe('01/10/2026 to 31/12/2026');
    expect(mapEnterpriseData({}, 'ANNUAL_2026_AN_001', 'fr').collectionPeriod).toBe('01/01/2026 au 31/12/2026');
  });

  // A changed process.env.TZ is not honoured inside a running jest worker on
  // every platform, so each zone runs in its own Node process.
  it.each(['UTC', 'Africa/Douala', 'America/New_York', 'Pacific/Kiritimati'])(
    'in a server running in %s',
    (tz) => {
      const helper = path.join(__dirname, '..', 'campaign', 'campaign-period.helper.ts').replace(/\\/g, '/');
      const script = `
        const h = require(${JSON.stringify(helper)});
        const p = h.collectionPeriodFromQuarterCode('QUARTERLY_2026_T4_001');
        const a = h.collectionPeriodFromQuarterCode('ANNUAL_2026_AN_001');
        process.stdout.write(JSON.stringify({
          localMidnight: new Date(2026, 9, 1).toISOString(),
          fr: h.formatCollectionPeriodFr(p),
          en: h.formatCollectionPeriodEn(p),
          annual: h.formatCollectionPeriodFr(a),
        }));`;
      const res = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e', script], {
        cwd: path.join(__dirname, '..', '..'),
        env: { ...process.env, TZ: tz },
        encoding: 'utf8',
      });
      expect(res.stderr).toBe('');
      const out = JSON.parse(res.stdout);
      // The zone is in effect: a local midnight is a different instant.
      if (tz === 'UTC') expect(out.localMidnight).toBe('2026-10-01T00:00:00.000Z');
      if (tz === 'Africa/Douala') expect(out.localMidnight).toBe('2026-09-30T23:00:00.000Z');
      expect(out.fr).toBe('01/10/2026 au 31/12/2026');
      expect(out.en).toBe('01/10/2026 to 31/12/2026');
      expect(out.annual).toBe('01/01/2026 au 31/12/2026');
    },
    60_000,
  );
});
