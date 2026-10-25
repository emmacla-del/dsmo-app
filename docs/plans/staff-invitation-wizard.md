# Staff invitation wizard — post-driven registration

Brief for whoever picks this up. Written 2026-10-25.

The wizard behind a group invitation link (`/inscription-agent?lien=…`,
`react-web/src/components/auth/GroupSignUpForm.tsx`) asks an incoming officer
to find their own service in a 126-node organigramme and then their post
inside it. The owner wants that inverted: the administrator fixes the post
when creating the link, the officer confirms it and supplies only their own
details, and the fields they are asked for follow from the post.

This restores the model of the Flutter MINEFOP wizard deleted in `54fcbb02`
(2026-08-28, "simplify registration to company-only"). That wizard's
`StepMinefopInfo` in `lib/screens/register_steps.dart` is worth reading before
starting — recover it with:

```bash
git show 54fcbb02^:lib/screens/register_steps.dart
```

Its header states the shape the owner is asking for:

```
STEP 4 — MINEFOP info
3-step cascade:
  Step 1: pick position type (e.g. CHEF_SERVICE)
  Step 2: pick immediate parent unit (e.g. the Sous-Direction)
  Step 3: pick exact service unit (e.g. the Service itself)
  → job title resolved from ServicePosition.title in database
```

and it gated territory on the role:

```dart
bool get _needsLocation  => role == 'REGIONAL' || role == 'DIVISIONAL';
bool get _needsDepartment => role == 'DIVISIONAL';
```

## What is already done

- `bc5e1e0d` — the form's feedback layer: every field validated in one pass,
  its own message under it, `aria-invalid`, `aria-required`, focus to the
  first problem, "(optional)" moved out of a placeholder, a real e-mail
  pattern, no raw `String(err)` shown to the user.
- `e18b53ab` — `service_positions` was **empty**, so every post dropdown in
  the platform offered only a generic fallback. 264 positions now exist (140
  named + one `STAFF` "Cadre" per service). `npm run seed:positions` is the
  idempotent script; `npm run seed` was also repaired but **must not be run**
  (see Constraints).

## Uncommitted work in the tree

`prisma/schema.prisma` already carries the two new columns on
`StaffInvitationLink` (`serviceCode`, `positionType`, both nullable, with a
doc comment). **The migration has not been written.** Start there.

## What is already in the data, unused

`MinefopService` carries, per service:

| column | meaning | live count |
|---|---|---|
| `roleMapping` | the role an account on this service gets | 98 `CENTRAL_AGENT`, 17 `REGIONAL_ADMIN`, 11 `DIVISIONAL_ADMIN` |
| `requiresRegion` | the post needs a region | 28 services |
| `requiresDepartment` | the post needs a department | 11 services |

`minefop-services.service.ts` already ships all three to the browser inside
the organigramme payload. **Nothing in `react-web` reads `requiresRegion` or
`requiresDepartment`.** The territorial rule the owner wants is already in the
data and already on the wire; the form simply ignores it. No new data and no
new endpoint are needed for that half.

`ServicePosition` is `(serviceCode, positionType)` unique with `title` /
`titleEn` — the resolved job title. `User` already has columns for everything
the old Flutter wizard collected: `matricule`, `poste`, `serviceCode`,
`positionType`, `positionTitle`, `region`, `department`.

## Phases

One commit per phase. Stop for diff review between phases.

### Phase 1 — migration

`StaffInvitationLink` gains `serviceCode` and `positionType`, both nullable
`TEXT`. Plain names, matching `region` and `department` on the same table,
which are also not foreign keys; the service is validated against the
organigramme at creation instead.

Additive only (`ADD COLUMN IF NOT EXISTS`), no backfill. A link created
before this keeps both null and must keep working exactly as it does today —
the officer chooses service and post. Treat that as a permanent fallback, not
a transition: decide explicitly whether links may still be made without a
post, and if not, enforce it at creation rather than by migrating old rows.

Approved by the owner in chat, 2026-10-25 (§21 — schema change). Record the
decision in `CLAUDE.md` §21 in its own `docs(constitution)` commit after the
code commit, per the project's code/docs separation.

### Phase 2 — link creation

`CreateGroupLinkDialog` in `react-web/src/components/admin/GroupInvitationLinks.tsx`
gains the post. Follow the old wizard's order: **position type first**, then
the service narrowed to units offering that type — not the service tree
first, which is the current form's order and the thing being fixed.

Server side, `staff-invitation-link.service.ts` stores both and validates
them. `assertServiceInScope` already checks a service against the link level;
extend the same check to the post, and keep `LEVEL_ROLE` as the authority on
which `roleMapping` a level may create.

### Phase 3 — the wizard

`GroupSignUpForm` reads the link's `serviceCode` / `positionType`:

- when both are set, show them as fixed — not as selects the officer can
  change — and resolve the job title from `ServicePosition.title`;
- when they are null, keep today's behaviour unchanged;
- ask for `matricule` always (it is a staff identity, not an afterthought;
  it is currently optional);
- ask for region and/or department **only** when the service's
  `requiresRegion` / `requiresDepartment` say so, mirroring `_needsLocation`
  and `_needsDepartment` from the deleted wizard.

Keep the feedback pattern from `bc5e1e0d`: all fields judged in one pass,
per-field messages, focus to the first problem. Any new field joins
`FIELD_ORDER`.

### Phase 4 — ONEFOP's posts

**Blocked on the owner.** Two questions outstanding:

1. ONEFOP exists already — `code: ONEFOP`, `category: RATTACHE`, `level: 1`,
   `parentCode: null`, `roleMapping: CENTRAL_AGENT` — sitting at the root
   beside `PIAASI` and `COSUP`. The owner says it is "attached to the
   Secrétariat Général". Does the tree actually nest it under `SG`
   (making it the only `RATTACHE` service with a parent), or is that the
   reporting line only?
2. Should the statistics chief be a `CHEF_SERVICE` position **on ONEFOP**, or
   a child service (`ONEFOP-STAT`, "Service des Statistiques") with that head,
   matching how SG's seven children are modelled?

Then add: a `DIRECTEUR` position titled "Secrétaire Permanent" (the owner
specified central-administration Director rank), and the statistics chief.
ONEFOP currently has exactly one position, the automatic `STAFF` "Cadre".

**Leave the SER out** until the owner confirms what it is.

`roleMapping` stays `CENTRAL_AGENT` and needs no decision: a service's role
may only be one of `REGIONAL_ADMIN`, `DIVISIONAL_ADMIN`, `CENTRAL_AGENT`
(`SERVICE_ROLES` in `staff-invitation.service.ts`), and `ADMIN_ONEFOP` is
"never derived from a service — a SUPER_ADMIN grants it explicitly". The
Super Admin assigns the real ONEFOP role afterwards from `ASSIGNABLE_ROLES`
(`auth.service.ts`), which includes both roles split out on 2026-10-25.

## Constraints

- **Never run `npm run seed`.** It creates test users sharing one weak
  password, sample companies and specimen ONEFOP submissions. The database
  behind the local backend is the **shared** one holding real registrations.
  Use `npm run seed:positions`, which touches `service_positions` only.
- The local backend (`localhost:3001`) talks to that shared database. Any
  write is a real write. Verify read-only where possible; for writes, use a
  transaction rolled back with a sentinel, as `src/pilotage/campaign-quota-pg.spec.ts`
  does.
- `npm run check:ui-grammar` in `react-web/` after any change under
  `app/admin/**` or `components/admin/**` — Phase 2 touches that path. Never
  raise the baseline to pass.
- New user-visible strings need both `messages/en.json` and `messages/fr.json`.
  Check whether a key is shared before rewording it: `nameRequired`,
  `passwordTooWeak` and `passwordMismatch` are shared with the one-person
  invite form at `src/app/inscription-agent/page.tsx`.
- Authentication architecture is §15 — do not redesign it. This work changes
  what a link carries and what the form asks for, not how accounts
  authenticate.

## Known loose ends

- The post dropdown now lists both "Officer" (the real `STAFF` position) and
  "Staff (no head post)" (`GENERIC_POSITION_TYPE`, the fallback from when the
  table was empty). They read almost identically. Decide whether the fallback
  is still needed now that 264 positions exist.
- `grantAdminOnefop` on the personal invite is a boolean, so it can mint
  `ADMIN_ONEFOP` at invite time but not either specialist role; those can only
  be assigned after the account exists.
