import { ConflictException } from '@nestjs/common';
import { GENERIC_POSITION_TYPE, assertPostIsVacant, isSingularPost } from './service-post';

/**
 * A head post has one holder per territory. The organigramme is a template --
 * one DREFOP, one DDEFOP -- so the same post of the same service is a
 * different post in every region, and the account's territory is part of its
 * identity. "Cadre" is the exception: every service offers it to any number
 * of officers.
 */

function store(holder: { id: string } | null) {
  const findFirst = jest.fn(async (_args: any) => holder);
  return { prisma: { user: { findFirst } }, findFirst };
}

const DELEGATE = {
  serviceCode: 'DREFOP',
  positionType: 'DELEGUE_REGIONAL',
  region: 'Centre',
  department: null,
};

describe('isSingularPost', () => {
  it('is every post but the generic one', () => {
    expect(isSingularPost('DELEGUE_REGIONAL')).toBe(true);
    expect(isSingularPost('CHEF_SERVICE')).toBe(true);
    expect(isSingularPost(GENERIC_POSITION_TYPE)).toBe(false);
    expect(isSingularPost('')).toBe(false);
    expect(isSingularPost('   ')).toBe(false);
    expect(isSingularPost(null)).toBe(false);
    expect(isSingularPost(undefined)).toBe(false);
  });
});

describe('assertPostIsVacant', () => {
  it('refuses a head post someone already holds in that territory', async () => {
    const { prisma } = store({ id: 'incumbent' });
    await expect(assertPostIsVacant(prisma, DELEGATE)).rejects.toThrow(ConflictException);
  });

  it('allows it when nobody holds it', async () => {
    const { prisma, findFirst } = store(null);
    await expect(assertPostIsVacant(prisma, DELEGATE)).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('asks about the post AND the territory, and only about a live holder', async () => {
    const { prisma, findFirst } = store(null);
    await assertPostIsVacant(prisma, DELEGATE);
    expect(findFirst.mock.calls[0][0]).toEqual({
      where: {
        serviceCode: 'DREFOP',
        positionType: 'DELEGUE_REGIONAL',
        region: { equals: 'Centre', mode: 'insensitive' },
        department: null,
        // A rejected request never held the post; a pending one does, so two
        // people cannot queue for it and leave the approver to find out.
        status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
      },
      select: { id: true },
    });
  });

  it('matches a division by region and department together', async () => {
    const { prisma, findFirst } = store(null);
    await assertPostIsVacant(prisma, {
      serviceCode: 'DDEFOP',
      positionType: 'DELEGUE_DEPARTEMENTAL',
      region: 'Centre',
      department: 'Mfoundi',
    });
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      region: { equals: 'Centre', mode: 'insensitive' },
      department: { equals: 'Mfoundi', mode: 'insensitive' },
    });
  });

  it('matches a central post on no territory at all', async () => {
    const { prisma, findFirst } = store(null);
    await assertPostIsVacant(prisma, {
      serviceCode: 'SG',
      positionType: 'SECRETAIRE_GENERAL',
      region: null,
      department: null,
    });
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ region: null, department: null });
  });

  it('never asks about the generic post: any number of cadres hold it', async () => {
    const { prisma, findFirst } = store({ id: 'another-cadre' });
    await expect(
      assertPostIsVacant(prisma, { ...DELEGATE, positionType: GENERIC_POSITION_TYPE }),
    ).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
