import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OnefopService } from './onefop.service';

/**
 * GET /onefop/submissions/:id and /:id/pdf scoping (gap report 3a/3b). Staff
 * reads used to be national; territorial roles are now scoped in the lookup
 * and an out-of-territory row is a 404, mirroring /admin/questionnaires/:id.
 */
describe('OnefopService submission detail/PDF territory scope', () => {
  // Littoral/Wouri submission owned by company c1.
  const row = { id: 's1', companyId: 'c1', region: 'Littoral', department: 'Wouri' };

  /** Minimal evaluation of the where fragments territoryWhere emits. */
  function matches(where: any, r: any): boolean {
    for (const [key, cond] of Object.entries<any>(where)) {
      if (key === 'id' && cond && typeof cond === 'object') {
        if (!cond.in.includes(r.id)) return false;
      } else if (cond && typeof cond === 'object' && 'equals' in cond) {
        if (String(r[key] ?? '').toLowerCase() !== String(cond.equals).toLowerCase()) return false;
      } else if (r[key] !== cond) {
        return false;
      }
    }
    return true;
  }

  let prisma: any;
  let pdf: any;
  let service: OnefopService;

  const queriedWhere = () => prisma.onefopSubmission.findFirst.mock.calls[0][0].where;

  beforeEach(() => {
    prisma = {
      company: { findFirst: jest.fn(async () => ({ id: 'c1' })) },
      onefopSubmission: {
        findFirst: jest.fn(async ({ where }: any) => (matches(where, row) ? { ...row } : null)),
      },
    };
    pdf = { getSignedUrl: jest.fn(async () => 'https://signed.example/s1.pdf') };
    service = new OnefopService(prisma, pdf);
  });

  const regional = (region: string | null) => ({ id: 'u1', role: 'REGIONAL_ADMIN', region });
  const divisional = (region: string | null, department: string | null) => ({
    id: 'u1', role: 'DIVISIONAL_ADMIN', region, department,
  });

  it('REGIONAL_ADMIN in the same region reads the submission (case-insensitive)', async () => {
    await expect(service.getSubmissionDetail(regional('LITTORAL'), 's1')).resolves.toMatchObject({ id: 's1' });
    expect(queriedWhere()).toEqual({ id: 's1', region: { equals: 'LITTORAL', mode: 'insensitive' } });
  });

  it('REGIONAL_ADMIN in another region gets 404, and no PDF URL is signed', async () => {
    await expect(service.getSubmissionDetail(regional('Centre'), 's1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getSubmissionPdfUrl('s1', regional('Centre'))).rejects.toBeInstanceOf(NotFoundException);
    expect(pdf.getSignedUrl).not.toHaveBeenCalled();
  });

  it('REGIONAL_ADMIN in the same region gets the PDF URL', async () => {
    await expect(service.getSubmissionPdfUrl('s1', regional('Littoral'))).resolves.toBe('https://signed.example/s1.pdf');
  });

  it('DIVISIONAL_ADMIN must match region AND department', async () => {
    await expect(service.getSubmissionDetail(divisional('Littoral', 'Wouri'), 's1')).resolves.toMatchObject({ id: 's1' });
    expect(queriedWhere()).toEqual({
      id: 's1',
      region: { equals: 'Littoral', mode: 'insensitive' },
      department: { equals: 'Wouri', mode: 'insensitive' },
    });
  });

  it('DIVISIONAL_ADMIN with the same department name in another region gets 404', async () => {
    await expect(service.getSubmissionDetail(divisional('Centre', 'Wouri'), 's1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['REGIONAL_ADMIN without a region', regional(null)],
    ['DIVISIONAL_ADMIN without a department', divisional('Littoral', null)],
  ])('%s gets 404 on detail and PDF', async (_label, user) => {
    await expect(service.getSubmissionDetail(user, 's1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getSubmissionPdfUrl('s1', user)).rejects.toBeInstanceOf(NotFoundException);
    expect(pdf.getSignedUrl).not.toHaveBeenCalled();
  });

  it.each(['SUPER_ADMIN', 'ADMIN_ONEFOP'])('%s reads nationally', async (role) => {
    await expect(service.getSubmissionDetail({ id: 'u1', role }, 's1')).resolves.toMatchObject({ id: 's1' });
    expect(queriedWhere()).toEqual({ id: 's1' });
  });

  it('COMPANY reads its own submission and PDF', async () => {
    await expect(service.getSubmissionDetail({ id: 'u-co', role: 'COMPANY' }, 's1')).resolves.toMatchObject({ id: 's1' });
    expect(queriedWhere()).toEqual({ id: 's1' });
    await expect(service.getSubmissionPdfUrl('s1', { id: 'u-co', role: 'COMPANY' })).resolves.toBe('https://signed.example/s1.pdf');
  });

  it('COMPANY reading another company submission keeps the existing 403', async () => {
    prisma.company.findFirst.mockResolvedValue({ id: 'c2' });
    await expect(service.getSubmissionDetail({ id: 'u-other', role: 'COMPANY' }, 's1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getSubmissionPdfUrl('s1', { id: 'u-other', role: 'COMPANY' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(pdf.getSignedUrl).not.toHaveBeenCalled();
  });
});
