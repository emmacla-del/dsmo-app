import { QuestionnairesService } from './questionnaires.service';
import { EligibilityEngineService } from './eligibility-engine.service';

/**
 * F12 (2026-10-10): the respondent's receipt prints the submission reference
 * (OnefopSubmission.submissionId), but the admin dossier page looked dossiers
 * up by their database id only, answering "introuvable". Both read lookups
 * now accept either, inside the caller's territory.
 */
describe('admin dossier lookup by id or receipt reference', () => {
  const REGIONAL = { role: 'REGIONAL_ADMIN', region: 'Littoral', department: null, regionId: null, departmentId: null } as any;

  it('getById matches the id or the submissionId, and keeps the territory filter', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'db-1', submissionId: 'ref-1', establishment: null });
    const service = new QuestionnairesService({ onefopSubmission: { findFirst } } as any);

    const found = await service.getById('ref-1', REGIONAL);

    expect(found.id).toBe('db-1');
    const where = findFirst.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ OR: [{ id: 'ref-1' }, { submissionId: 'ref-1' }] });
    expect(JSON.stringify(where.AND[1])).toContain('Littoral');
  });

  it('getById still answers not found when neither matches', async () => {
    const service = new QuestionnairesService({ onefopSubmission: { findFirst: jest.fn().mockResolvedValue(null) } } as any);
    await expect(service.getById('unknown')).rejects.toThrow('not found');
  });

  it('the diagnostic resolves the same way', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const engine = new EligibilityEngineService({ onefopSubmission: { findFirst } } as any);
    await expect(engine.evaluateDossier('ref-1', REGIONAL)).rejects.toThrow('introuvable');
    expect(findFirst.mock.calls[0][0].where.AND[0]).toEqual({ OR: [{ id: 'ref-1' }, { submissionId: 'ref-1' }] });
  });
});
