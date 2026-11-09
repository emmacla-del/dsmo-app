# Moving the Supabase database to Frankfurt

**Status:** not started. Nothing here has been run, including the commands and
the script below. The rehearsal in Phase 2 is what tests them.

**Why:** Render runs in Frankfurt and the database is in Ireland. Each Prisma
read costs about five round trips of about 22 ms, so about 0.1 s. In one region
that should fall to a few hundredths of a second (estimate, not measured).

**Approval:** this is a major infrastructure change under CLAUDE.md §21. The
owner must approve it in chat before Phase 3, and it is recorded in §21 afterwards.

## Do this first

Do not start until all of these are true:

- [ ] The Render backend is on a paid plan.
- [ ] The commits on `master` are pushed and deployed. They carry three migrations
      (`20261030120000`, `20261101120000`, `20261101130000`) that must run on the
      old database before it is copied.
- [ ] Production pages have been timed, and they are still slow enough to justify
      this move. Keep those timings: they are the "before" figures.

## What moves and what does not

| Item | What happens to it |
|---|---|
| `public` schema: 74 models, `_prisma_migrations`, enums, sequences | Copied with `pg_dump` |
| Storage bucket `dsmo-pdfs` | Copied separately with the script below; `pg_dump` does not include it |
| Supabase Auth | Not used, nothing to move |
| Extensions, row-level security, scheduled jobs | None in the migrations |
| `JWT_SECRET` | Stays the same on Render, so users stay signed in |

The establishment ID sequences are created per territory, and they must carry
their current values across, or new IDs would repeat old ones. `pg_dump` includes
those values; Phase 2 checks them.

## Phase 1: create the new project

1. Create a Supabase project in **Central EU (Frankfurt), `eu-central-1`**, in the
   same organisation and on the same plan as the old one.
2. Note its Postgres version. If it is older than the old project's, stop and ask.
3. Create the bucket `dsmo-pdfs` with the same Public/Private setting, file size
   limit and allowed types as the old one. Read these from the old dashboard.
4. Turn off the **Data API** in the new project's settings. The app reaches tables
   through Prisma only, and without row-level security the Data API could expose
   them. Storage does not depend on it.
5. From the **Connect** dialog, copy the connection strings. Do not edit the old
   ones by hand: the pooler host may differ.

## Phase 2: rehearsal (production keeps running)

Work in a folder **outside the repository**: the dump holds personal data.

```bash
mkdir -p ~/camleap-migration
```

```bash
cd ~/camleap-migration
```

Enter each session pooler string (port 5432) without leaving it in shell history:

```bash
read -rs OLD_DB && export OLD_DB
```

```bash
read -rs NEW_DB && export NEW_DB
```

**2.1 Copy the database.**

```bash
pg_dump "$OLD_DB" --schema=public --no-owner --no-privileges --file=rehearsal.sql
```

```bash
psql "$NEW_DB" -f rehearsal.sql 2> restore-errors.log
```

Read `restore-errors.log` line by line. `schema "public" already exists` is
expected. Anything else must be explained before going further.

**2.2 Compare every table.** Save this as `counts.sql`:

```sql
SELECT table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

```bash
psql "$OLD_DB" -At -f counts.sql > counts-old.txt
```

```bash
psql "$NEW_DB" -At -f counts.sql > counts-new.txt
```

```bash
diff counts-old.txt counts-new.txt
```

Production keeps writing during a rehearsal, so small differences are normal here.
During the real switch the diff must be empty.

**2.3 Compare the sequences.**

```bash
psql "$OLD_DB" -At -c "SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1" > seq-old.txt
```

```bash
psql "$NEW_DB" -At -c "SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1" > seq-new.txt
```

```bash
diff seq-old.txt seq-new.txt
```

**2.4 Check Prisma sees nothing to apply.** From the repository, in a shell with
`DATABASE_URL` and `DIRECT_URL` set to the new project:

```bash
npx prisma migrate status
```

It must report the database schema as up to date.

**2.5 Copy the stored files.** Save the script at the end of this document as
`tmp-copy-storage.mjs` in the repository root, so it finds `@supabase/supabase-js`.
Do not commit it. It copies only what the new bucket lacks, so it can run again.

```bash
node tmp-copy-storage.mjs
```

It needs `OLD_SUPABASE_URL`, `OLD_SUPABASE_KEY`, `NEW_SUPABASE_URL` and
`NEW_SUPABASE_KEY` (the service role keys). Its last line must report 0 missing.

**2.6 Find out what the stored links hold.** Run on the old database:

```sql
SELECT 'declarations.pdfUrl' AS field, count(*) FROM declarations WHERE "pdfUrl" LIKE '%.supabase.co/%'
UNION ALL SELECT 'declarations.receiptUrl', count(*) FROM declarations WHERE "receiptUrl" LIKE '%.supabase.co/%'
UNION ALL SELECT 'reports.fileUrl', count(*) FROM reports WHERE "fileUrl" LIKE '%.supabase.co/%'
UNION ALL SELECT 'onefop_submissions.pdfUrl', count(*) FROM onefop_submissions WHERE "pdfUrl" LIKE '%.supabase.co/%'
UNION ALL SELECT 'companies.attestationUrl', count(*) FROM companies WHERE "attestationUrl" LIKE '%.supabase.co/%';
```

Any count above zero is a link tied to the old project. A signed link cannot be
repaired by changing its host, because the old project signed it, so it has to be
produced again from the file's storage path. `companies.attestationUrl` is written
as a storage path today, and `reports` keeps a `filePath` beside its link, so
those two should be safe. **Decide how to handle any non-zero count before Phase 3.**

**2.7 Try the app on the new project.** Start a local backend against the new
project and open a dossier and a stored PDF. Then set your local settings back.

**2.8 Time the rehearsal.** The time taken by 2.1 to 2.5 sets the length of the
real window. Add 30 minutes for checks.

**2.9 Empty the new project** so the real copy starts clean. This deletes data, so
first confirm the host printed is the **new** project:

```bash
psql "$NEW_DB" -At -c "SELECT inet_server_addr()"; echo "$NEW_DB" | sed 's#//.*@#//#'
```

```bash
psql "$NEW_DB" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;'
```

Leave the copied files in the bucket: the script will add only what is new.

## Phase 3: the switch

**Before the day**

- [ ] The owner has approved the switch in chat.
- [ ] Pick a quiet time, away from any campaign deadline.
- [ ] Tell users at least two days ahead. E-mail delivery is unreliable, so do not
      rely on it alone.
- [ ] Take a fresh backup of the old project.
- [ ] Store the four current Render values somewhere safe, for rollback.
- [ ] Stop every local backend. Anything still connected could write to the old database.

**During the window**

1. Turn on maintenance mode in `/admin/parametres`, with a message giving the
   return time. It shows users a clear notice.
2. **Suspend the backend on Render.** This is the step that actually stops writes.
   Maintenance mode covers only routes behind `RolesGuard`, so public routes such
   as registration may still write, and the 06:00 campaign job would still run.
3. Run 2.1 again, with `final.sql` in place of `rehearsal.sql`.
4. Run 2.2 and 2.3. **Both diffs must be empty.** If not, stop and roll back.
5. Run 2.5. It must report 0 missing.
6. On Render, set the new `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. Copy the shape of the current values: the same
   port and the same `pgbouncer=true` setting. Do not guess it. A session-mode
   string on `DATABASE_URL` could bring back the 15-connection limit behind the
   errors of 2026-10-05.
7. Resume the backend and deploy. In the logs, `prisma migrate deploy` must report
   no pending migrations.
8. The new database carries maintenance mode over, so only `SUPER_ADMIN` can use
   the app. Use that to check, signed in as `SUPER_ADMIN`:
   - [ ] Sign-in works, and an existing session stays signed in.
   - [ ] `/admin/dossiers` lists the expected files, and one file opens.
   - [ ] An existing PDF downloads.
   - [ ] A new PDF can be generated, which proves storage writes work.
   - [ ] Backend logs show no connection errors.
9. Turn off maintenance mode. Watch the logs, and confirm the first real
   submission lands in the new database.

## Rollback

**While maintenance mode is still on:** nothing is lost. Put the four old values
back on Render, redeploy, and turn off maintenance mode on the old database.

**After users have written to the new database:** going back loses those writes
unless they are copied across by hand. Roll back only for a failure that cannot be
fixed forward, and take a dump of the new database first.

Set a limit before starting: if the checks in step 8 do not pass within 30 minutes
of the planned end of the window, roll back and try another day.

## Afterwards

- [ ] Update your local `.env` to the new project.
- [ ] Time the same production pages again and compare with the "before" figures.
- [ ] Delete `rehearsal.sql`, `final.sql` and `tmp-copy-storage.mjs` once the
      switch is confirmed.
- [ ] Record the decision in CLAUDE.md §21.
- [ ] Keep the old project for at least two to four weeks, and pause it only once
      any links from 2.6 are dealt with. Do not delete it early.

## Storage copy script

Rehearse this first. It has never been run.

```js
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'dsmo-pdfs';
const { OLD_SUPABASE_URL, OLD_SUPABASE_KEY, NEW_SUPABASE_URL, NEW_SUPABASE_KEY } = process.env;
const oldStore = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY).storage.from(BUCKET);
const newStore = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY).storage.from(BUCKET);

// Every file path in a bucket. An entry with no id is a folder.
async function listAll(store, prefix = '') {
  const paths = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await store.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) paths.push(path);
      else paths.push(...(await listAll(store, path)));
    }
    if (data.length < 1000) return paths;
  }
}

const present = new Set(await listAll(newStore));
const wanted = await listAll(oldStore);
const missing = wanted.filter((path) => !present.has(path));
console.log(`${wanted.length} files in the old bucket, ${missing.length} to copy`);

for (const path of missing) {
  const { data, error } = await oldStore.download(path);
  if (error) throw error;
  const { error: uploadError } = await newStore.upload(path, data, { contentType: data.type });
  if (uploadError) throw uploadError;
}

const after = new Set(await listAll(newStore));
console.log(`${wanted.filter((path) => !after.has(path)).length} missing`);
```
