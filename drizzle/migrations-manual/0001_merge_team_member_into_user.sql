-- Option A: merge team_member into user. Run once per database.
-- Safe to re-run because every step uses idempotent guards.

BEGIN;

-- 1) Add identity fields to user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS workshop_role TEXT;

-- 2) Backfill org/workshop_role from team_members that already match an existing user by email
UPDATE "user" u
SET
  organization = COALESCE(u.organization, tm.organization),
  workshop_role = COALESCE(u.workshop_role, tm.role)
FROM team_member tm
WHERE lower(tm.email) = lower(u.email);

-- 3) Create placeholder users for team_members that don't yet have a matching login
--    Use a synthetic email when team_member.email is null so the user.email NOT NULL + UNIQUE
--    constraint is satisfied.
INSERT INTO "user" (id, name, email, email_verified, role, organization, workshop_role, created_at, updated_at)
SELECT
  'stake_' || tm.id::text,
  tm.name,
  COALESCE(NULLIF(lower(tm.email), ''), 'stakeholder-' || tm.id::text || '@lummus.local'),
  false,
  'user',
  tm.organization,
  tm.role,
  tm.created_at,
  now()
FROM team_member tm
WHERE NOT EXISTS (
  SELECT 1 FROM "user" u
  WHERE lower(u.email) = lower(tm.email)
     OR u.id = 'stake_' || tm.id::text
)
ON CONFLICT (id) DO NOTHING;

-- 4) Add user_id columns to workshop_participant and hours_entry (nullable for backfill)
ALTER TABLE workshop_participant ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE hours_entry ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 5) Backfill user_id by resolving team_member_id → user (via email match or synthetic id)
UPDATE workshop_participant wp
SET user_id = (
  SELECT u.id
  FROM team_member tm
  JOIN "user" u
    ON lower(u.email) = lower(tm.email)
    OR u.id = 'stake_' || tm.id::text
  WHERE tm.id = wp.team_member_id
  LIMIT 1
)
WHERE wp.user_id IS NULL AND wp.team_member_id IS NOT NULL;

UPDATE hours_entry he
SET user_id = (
  SELECT u.id
  FROM team_member tm
  JOIN "user" u
    ON lower(u.email) = lower(tm.email)
    OR u.id = 'stake_' || tm.id::text
  WHERE tm.id = he.team_member_id
  LIMIT 1
)
WHERE he.user_id IS NULL AND he.team_member_id IS NOT NULL;

-- 6) Drop the old FK columns and constraints (cascade also drops the indexes referencing them)
ALTER TABLE workshop_participant DROP COLUMN IF EXISTS team_member_id;
ALTER TABLE hours_entry DROP COLUMN IF EXISTS team_member_id;

-- 7) Add NOT NULL + FK on the new user_id columns
ALTER TABLE workshop_participant ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE workshop_participant
  ADD CONSTRAINT workshop_participant_user_id_user_id_fk
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

ALTER TABLE hours_entry
  ADD CONSTRAINT hours_entry_user_id_user_id_fk
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL;

-- 8) Recreate participant index on the new column
DROP INDEX IF EXISTS workshop_participant_workshop_idx;
CREATE INDEX workshop_participant_workshop_idx ON workshop_participant(workshop_id);
CREATE INDEX IF NOT EXISTS workshop_participant_user_idx ON workshop_participant(user_id);

DROP INDEX IF EXISTS hours_member_idx;
CREATE INDEX IF NOT EXISTS hours_user_idx ON hours_entry(user_id);

-- 9) Drop the now-unused team_member table
DROP TABLE IF EXISTS team_member CASCADE;

COMMIT;
