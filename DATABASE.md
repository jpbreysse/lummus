# Database access

Quick reference for working with Postgres locally and on Scalingo.

## Local Postgres (Docker)

The app expects a Postgres 16 container listening on `localhost:5432`. The existing `postgres-pgvector` container (used across several projects) works fine.

```sh
docker ps --filter name=postgres-pgvector
```

If not running:

```sh
docker run -d \
  --name postgres-pgvector \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### Connection

`.env`:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/lummus
```

Create the database once:
```sh
docker exec postgres-pgvector psql -U postgres -c "CREATE DATABASE lummus;"
```

## Apply / update schema

`src/lib/server/db/schema.ts` is the source of truth. After editing it:

```sh
npm run db:push          # interactive — prompts before destructive changes
# or non-interactive (safe when schema diffs are additive only):
npx drizzle-kit push --force
```

For production you'd prefer generate + migrate instead of push:

```sh
npm run db:generate      # creates a .sql migration under drizzle/
npm run db:migrate       # applies pending migrations
```

## Seed starter data

The seed script wipes domain tables (workshops/team/questions/hours) and reinserts the 4-workshop Phase 2 dataset. **It does not touch users, invites, or announcements** — safe to re-run:

```sh
npm run db:seed
```

## Inspect via psql

Open an interactive session on the local DB:

```sh
docker exec -it postgres-pgvector psql -U postgres -d lummus
```

Useful commands once inside:

```
\dt                           -- list tables
\d workshop                   -- describe one
\d+ question                  -- with defaults/indexes
SELECT email, role FROM "user";
SELECT code, status, scheduled_at FROM workshop ORDER BY week_number;
```

Note: `user` is a reserved word — always quote it: `"user"`.

One-liner without interactive mode:

```sh
docker exec postgres-pgvector psql -U postgres -d lummus \
  -c 'SELECT count(*) FROM question;'
```

## Drizzle Studio (GUI)

```sh
npm run db:studio
```

Opens `https://local.drizzle.studio` in your browser — runs locally, connects to `DATABASE_URL` from `.env`. Good for browsing rows, editing cell values, running queries. Does NOT run schema migrations; use `db:push` for that.

## Reset a user's password (local)

When you forget a test user's password, recreate them:

```sh
docker exec postgres-pgvector psql -U postgres -d lummus \
  -c "DELETE FROM \"user\" WHERE email='name@test.com';"

DATABASE_URL="postgres://postgres:postgres@localhost:5432/lummus" \
  npx tsx scripts/create-user.ts "Name" "name@test.com" "newpassword"
```

The script uses Better Auth's `signUpEmail` so the password is scrypt-hashed correctly. First user created becomes admin (empty-table check in the `databaseHook`).

## Bootstrap an invite (local)

Signup requires an invite code. When the invite table is empty, drop one in directly:

```sh
docker exec postgres-pgvector psql -U postgres -d lummus \
  -c "INSERT INTO invite (code, expires_at) VALUES ('LOCAL', now() + interval '7 days');"
```

Then visit `http://localhost:5174/signup?invite=LOCAL`.

## Remote (Scalingo) access

Open an SSH tunnel to the Scalingo Postgres addon:

```sh
scalingo --app <app-name> db-tunnel -i ~/.ssh/id_ed25519 SCALINGO_POSTGRESQL_URL
```

This prints `You can access your database on: 127.0.0.1:10000`. Get the credentials (password changes per session):

```sh
scalingo --app <app-name> env | grep SCALINGO_POSTGRESQL_URL
```

Swap the `host:port` part of that URL for `127.0.0.1:10000` and use it as `DATABASE_URL` for any command:

```sh
# Push schema
DATABASE_URL="postgres://USER:PASS@127.0.0.1:10000/DBNAME?sslmode=prefer" \
  npx drizzle-kit push --force

# Inspect with psql
psql "postgres://USER:PASS@127.0.0.1:10000/DBNAME?sslmode=prefer" -c '\dt'

# Seed
DATABASE_URL="postgres://USER:PASS@127.0.0.1:10000/DBNAME?sslmode=prefer" \
  npm run db:seed
```

Kill the tunnel when done (Ctrl+C in its terminal).

## Backups

Two complementary backup paths. Use the one that matches your need.

### A. Daily local copy of Scalingo's nightly backup (recommended)

Scalingo automatically snapshots the Postgres addon every night around 02:00 CEST. `scripts/backup-from-scalingo.sh` downloads the latest one via the Scalingo CLI — **no tunnel, no pg_dump needed**.

```sh
./scripts/backup-from-scalingo.sh             # download the most recent existing backup
./scripts/backup-from-scalingo.sh --trigger   # ask Scalingo to create a fresh backup, then download
./scripts/backup-from-scalingo.sh --help
```

Output: `backups/scalingo-YYYYMMDD-HHMMSS-<id>.tar.gz` (gitignored).

The archive contains a Postgres custom-format dump produced by Scalingo. Inspect / extract:

```sh
tar -tzf  backups/scalingo-...tar.gz
tar -xzf  backups/scalingo-...tar.gz -C backups/
```

#### Daily schedule (macOS launchd)

A launchd plist runs the script every day at **09:30 local**. Install it once:

```sh
cp scripts/com.lummus.backup-daily.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/com.lummus.backup-daily.plist
```

Verify, log, run on demand, uninstall:

```sh
launchctl list | grep com.lummus                                 # see it's loaded
cat /tmp/lummus-backup.log                                       # job output (stdout + stderr)
launchctl kickstart -k gui/$(id -u)/com.lummus.backup-daily      # fire it now
launchctl unload ~/Library/LaunchAgents/com.lummus.backup-daily.plist
```

If the Mac is asleep at 09:30 the job fires as soon as it wakes (launchd's missed-run semantics).

### B. Ad-hoc full dump through an open tunnel

When you need a backup right now from your local pg_dump (useful immediately before a risky migration), open a tunnel and run:

```sh
scalingo --app crmenergy db-tunnel SCALINGO_POSTGRESQL_URL   # leave open
./scripts/backup-prod.sh                                     # full dump, custom format
./scripts/backup-prod.sh --schema                            # structure only
./scripts/backup-prod.sh --data                              # rows only
./scripts/backup-prod.sh --plain                             # gzipped plain SQL
```

Output: `backups/lummus-<mode>-YYYYMMDD-HHMMSS.dump` (custom format, gitignored).

The script pulls `SCALINGO_POSTGRESQL_URL` from `scalingo env`, rewrites the host to `127.0.0.1:10000`, and runs `pg_dump --no-owner --no-privileges` so the dump restores cleanly into any database.

### Restoring a backup

```sh
# Custom-format dump (from either A or B with default options)
createdb lummus_restore
pg_restore -d lummus_restore --no-owner --no-privileges backups/<file>.dump

# Plain SQL (from B --plain)
gunzip -c backups/<file>.sql.gz | psql -d lummus_restore
```

### Configuration

Both scripts default to the `crmenergy` app and the Postgres addon ID baked into `scripts/backup-from-scalingo.sh`. Override via env vars when needed:

```sh
SCALINGO_APP=other-app SCALINGO_PG_ADDON=ad-... ./scripts/backup-from-scalingo.sh
TUNNEL_PORT=11000 ./scripts/backup-prod.sh
```

### Retention

No automatic cleanup yet — `backups/` accumulates indefinitely. The dumps are tiny (~20 K each at current data volume) so this is fine for months; revisit if it grows.

## Table inventory (current app)

```
Auth (Better Auth)
  user, session, account, verification

Access control
  invite

News
  announcement

Domain
  workshop, workshop_participant,
  question, question_response, question_anonymous_response,
  question_comment, question_history,
  hours_entry, effort_log
```

Enums: `user_role` (admin/user), `workshop_status` (upcoming/in_progress/completed/cancelled), `question_status` (open/answered/deferred).

Workshop roles (free-text columns, validated against `src/lib/workshop-roles.ts`): `PM`, `Engineer`, `IT`. Stored on `user.workshop_role`, `invite.workshop_role`, and `question.target_role`.
