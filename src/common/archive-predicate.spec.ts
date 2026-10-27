import {
  ANY_ARCHIVE_STATE,
  ARCHIVED_ONLY,
  NOT_ARCHIVED,
  archiveReadPredicate,
} from './archive-predicate';

describe('archiveReadPredicate', () => {
  const readActions = [
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
  ];

  it.each(['User', 'OnefopSubmission'])('filters ordinary %s read actions by default', async (model) => {
    for (const action of readActions) {
      const params: any = { model, action, args: { where: { status: 'ACTIVE' } } };
      const result = await archiveReadPredicate(params, async (nextParams) => nextParams.args?.where);
      if (action.startsWith('findUnique')) {
        expect(result).toEqual({ status: 'ACTIVE', ...NOT_ARCHIVED });
      } else {
        expect(result).toEqual({ AND: [{ status: 'ACTIVE' }, NOT_ARCHIVED] });
      }
    }
  });

  it('keeps unique selectors at the top level', async () => {
    const params: any = { model: 'User', action: 'findUnique', args: { where: { id: 'user-1' } } };
    await archiveReadPredicate(params, async (nextParams) => {
      expect(nextParams.args?.where).toEqual({ id: 'user-1', ...NOT_ARCHIVED });
      return null;
    });
  });

  it('honors explicit archived-only and include-all reads', async () => {
    for (const state of [ARCHIVED_ONLY, ANY_ARCHIVE_STATE]) {
      const params: any = {
        model: 'OnefopSubmission',
        action: 'findMany',
        args: { where: { AND: [{ status: 'APPROVED' }, state] } },
      };
      const result = await archiveReadPredicate(params, async (nextParams) => nextParams.args?.where);
      expect(result).toEqual({
        AND: [{ AND: [{ status: 'APPROVED' }, state] }, NOT_ARCHIVED],
      });
    }
  });

  it('recognizes a top-level archivedAt selector as an explicit archive state', async () => {
    const where = { status: 'APPROVED', ...ARCHIVED_ONLY };
    const params: any = { model: 'OnefopSubmission', action: 'findMany', args: { where } };
    const result = await archiveReadPredicate(params, async (nextParams) => nextParams.args?.where);
    expect(result).toEqual(where);
  });

  it('does not let a nested include archive selector suppress top-level filtering', async () => {
    const params: any = {
      model: 'OnefopSubmission',
      action: 'findMany',
      args: {
        where: { status: 'APPROVED' },
        include: { foo: { where: { archivedAt: null } } },
      },
    };
    const result: any = await archiveReadPredicate(params, async (nextParams) => nextParams.args);
    expect(result.where).toEqual({ AND: [{ status: 'APPROVED' }, NOT_ARCHIVED] });
    expect(result.include).toEqual({ foo: { where: { archivedAt: null } } });
  });

  it('filters Company reads through its owner and leaves writes untouched', async () => {
    const companyParams: any = { model: 'Company', action: 'findMany', args: { where: { name: 'x' } } };
    const companyResult = await archiveReadPredicate(companyParams, async (nextParams) => nextParams.args?.where);
    expect(companyResult).toEqual({ name: 'x', AND: [{ user: { is: NOT_ARCHIVED } }] });
    const uniqueCompany: any = { model: 'Company', action: 'findUnique', args: { where: { id: 'company-1' } } };
    const uniqueResult = await archiveReadPredicate(uniqueCompany, async (nextParams) => nextParams.args?.where);
    expect(uniqueResult).toEqual({ id: 'company-1', user: { is: NOT_ARCHIVED } });
    for (const params of [
      { model: 'User', action: 'update', args: { where: { id: 'user-1' } } },
    ]) {
      const result = await archiveReadPredicate(params as any, async (nextParams) => nextParams.args?.where);
      expect(result).toEqual(params.args.where);
    }
  });
});
