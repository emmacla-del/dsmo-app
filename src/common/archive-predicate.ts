/** Default visibility for archived records. */
export const NOT_ARCHIVED = { archivedAt: null } as const;

/** Explicitly select archived records, for restore and archive-management flows. */
export const ARCHIVED_ONLY = { archivedAt: { not: null } } as const;

/** An explicit include-all condition used by the completed view. */
export const ANY_ARCHIVE_STATE = {
  OR: [{ archivedAt: null }, { archivedAt: { not: null } }],
};

export function archiveState(includeArchived = false) {
  return includeArchived ? ANY_ARCHIVE_STATE : NOT_ARCHIVED;
}

export function withArchiveState<T extends Record<string, unknown>>(
  where: T,
  includeArchived = false,
) {
  return { AND: [where, archiveState(includeArchived)] };
}

type ArchiveReadParams = {
  model?: string;
  action: string;
  args?: { where?: Record<string, unknown>; [key: string]: unknown };
};

const ARCHIVE_MODELS = new Set(['User', 'OnefopSubmission', 'Company']);
const READ_ACTIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

function hasExplicitArchiveState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasExplicitArchiveState);
  const obj = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, 'archivedAt')) return true;
  return false;
}

/**
 * Prisma middleware that gives every ordinary User and OnefopSubmission
 * read the same default archive boundary. A query that explicitly mentions
 * archivedAt owns its archive behavior (including the completed-view
 * include-all condition) and is left intact.
 */
export function archiveReadPredicate<P extends ArchiveReadParams>(
  params: P,
  next: (params: P) => Promise<unknown>,
) {
  if (
    !params.model ||
    !ARCHIVE_MODELS.has(params.model) ||
    !READ_ACTIONS.has(params.action)
  ) {
    return next(params);
  }

  const where = params.args?.where ?? {};
  if (hasExplicitArchiveState(where)) return next(params);

  if (params.model === 'Company') {
    // Company rows are the registration-facing projection of a User. Filter
    // through the required owner relation so an archived registration cannot
    // reappear through a Company-rooted list, count, search, or detail read.
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND === undefined
        ? []
        : [where.AND];
    params.args = {
      ...params.args,
      where: params.action.startsWith('findUnique')
        ? { ...where, user: { is: NOT_ARCHIVED } }
        : { ...where, AND: [...existingAnd, { user: { is: NOT_ARCHIVED } }] },
    };
    return next(params);
  }

  // findUnique's selector must remain at the top level for Prisma's
  // WhereUniqueInput validation. Other read actions accept the conjunction.
  const filteredWhere = params.action.startsWith('findUnique')
    ? { ...where, ...NOT_ARCHIVED }
    : { AND: [where, NOT_ARCHIVED] };

  params.args = { ...params.args, where: filteredWhere };
  return next(params);
}
