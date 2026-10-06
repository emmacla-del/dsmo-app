-- Establishment ID serials move from MAX()+1 to Postgres sequences, and the
-- ID is generated at registration instead of at approval.
--
-- Policy: an establishment ID is generated at registration from a
-- sequential counter. Gaps are allowed; a number is never issued twice.
-- MAX()+1 over companies could not hold that: a rolled-back allocation was
-- re-issued, and deleting the top row (as 20261004130000 did by raw SQL)
-- made its number available again.
--
-- One sequence per (prefix, two-digit year), named
-- establishment_serial_<prefix lower><yy>, e.g. establishment_serial_en26.
-- The format does not change: {prefix}{yy}{serial 4}{subdivision suffix 2},
-- and the serial still restarts each year (UTC). MAXVALUE 9999 NO CYCLE, so
-- the 10000th ID of a (prefix, year) fails loudly (the API returns a 409)
-- instead of producing an 11-character code.
--
-- Sequences for a (prefix, year) not seen yet are created on first use by
-- establishment_serial_ensure(), so no yearly migration is needed. The seed
-- is the highest serial ever recorded for that pair in companies,
-- establishments or the issuance audit rows, so a number whose company row
-- was later deleted is still not reissued. nextval() never rolls back, so a
-- registration that fails after taking a number leaves a gap, as intended.
--
-- No advisory lock: nextval() is atomic, and two concurrent first uses
-- collide on pg_class's unique index; the loser's CREATE is caught below.
--
-- Privileges: the function is revoked from PUBLIC and from the Supabase API
-- roles anon and authenticated, so it cannot be called as a PostgREST RPC
-- to burn serials.
-- The sequences are left as created: the runtime role creates or owns them
-- and needs USAGE for nextval().
--
-- Supersedes the allocation notes in
-- 20261002160000_unique_company_establishment_id (advisory lock, "companies
-- awaiting approval are unaffected"). That file is applied and is not
-- edited.

-- CreateFunction
CREATE FUNCTION public.establishment_serial_ensure(p_prefix text, p_yy text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_seq  text;
    v_last integer;
BEGIN
    IF p_prefix IS NULL OR p_prefix !~ '^(EN|CO|CT|ON|AD|PP|VT)$' THEN
        RAISE EXCEPTION 'establishment_serial_ensure: unknown prefix %', p_prefix;
    END IF;
    IF p_yy IS NULL OR p_yy !~ '^[0-9]{2}$' THEN
        RAISE EXCEPTION 'establishment_serial_ensure: invalid year %', p_yy;
    END IF;

    v_seq := 'establishment_serial_' || lower(p_prefix) || p_yy;
    IF to_regclass('public.' || v_seq) IS NOT NULL THEN
        RETURN 'public.' || v_seq;
    END IF;

    SELECT COALESCE(MAX(substring(issued.code FROM 5 FOR 4)::integer), 0)
      INTO v_last
      FROM (
            SELECT c."establishmentId" AS code FROM companies c
            UNION ALL
            SELECT left(e.code, 10) FROM establishments e
            UNION ALL
            SELECT a.details ->> 'establishmentId'
              FROM audit_logs a
             WHERE a.action IN ('COMPANY_ESTABLISHMENT_ID_ISSUED',
                                'COMPANY_REGISTRATION_APPROVED',
                                'COMPANY_REGISTRATION_AUTO_APPROVED',
                                'COMPANY_ESTABLISHMENT_ID_BACKFILLED')
           ) issued
     WHERE issued.code ~ ('^' || p_prefix || p_yy || '[0-9]{6}$');

    BEGIN
        EXECUTE format(
            'CREATE SEQUENCE public.%I AS integer MINVALUE 1 MAXVALUE 9999 START WITH %s NO CYCLE',
            v_seq, v_last + 1);
    EXCEPTION
        WHEN duplicate_table OR unique_violation THEN
            -- A concurrent first use created it, seeded from the same data.
            NULL;
    END;
    RETURN 'public.' || v_seq;
END;
$$;

-- Seed: create the sequence of every (prefix, year) that already has IDs,
-- so its starting point is fixed here rather than by the first request
-- after deploy.
DO $$
DECLARE
    k record;
BEGIN
    FOR k IN
        SELECT DISTINCT substring(code FROM 1 FOR 2) AS prefix,
                        substring(code FROM 3 FOR 2) AS yy
          FROM (
                SELECT "establishmentId" AS code FROM companies
                UNION ALL
                SELECT left(code, 10) FROM establishments
               ) existing
         WHERE code ~ '^(EN|CO|CT|ON|AD|PP|VT)[0-9]{8}$'
    LOOP
        PERFORM public.establishment_serial_ensure(k.prefix, k.yy);
    END LOOP;
END;
$$;

-- Keep the function off the Supabase REST API: an RPC that anyone can call
-- would burn serials. Postgres grants EXECUTE on a new function to PUBLIC,
-- which anon and authenticated inherit, so revoking from those two alone
-- would not take; PUBLIC is revoked first. The owner (the migration role,
-- postgres, which is also the runtime role) keeps EXECUTE as owner.
-- Supabase's default privileges may also grant it to anon and authenticated
-- directly, hence the explicit revokes, guarded so a plain Postgres without
-- those roles (local, shadow database) still migrates.
REVOKE ALL ON FUNCTION public.establishment_serial_ensure(text, text) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.establishment_serial_ensure(text, text) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.establishment_serial_ensure(text, text) FROM authenticated;
    END IF;
END;
$$;
