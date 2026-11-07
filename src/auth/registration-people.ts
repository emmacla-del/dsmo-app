// src/auth/registration-people.ts
//
// The staff a page of registrations names: who archived, registered or holds
// each file. Prisma runs one query per nested relation, one after another, so
// the list paid three round trips for these; this is one for the whole page.
import { Prisma } from '@prisma/client';

export interface RegistrationPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

type RawReader = { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> };

/**
 * Whoever the ids name, archived or not, as the relations read them: a file
 * keeps showing who handled it after that account is archived.
 */
export async function loadRegistrationPeople(
  prisma: RawReader,
  ids: Array<string | null | undefined>,
): Promise<Map<string, RegistrationPerson>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.$queryRaw<RegistrationPerson[]>(Prisma.sql`
    SELECT id, "firstName", "lastName", email
    FROM "users"
    WHERE id IN (${Prisma.join(unique)})
  `);
  return new Map(rows.map((row) => [row.id, row]));
}
