# Security overview

This document summarizes the security posture of the Lummus Phase 2 application as deployed at `https://crmenergy.osc-fr1.scalingo.io`. It is intended for security reviewers — both the controls in place and the known gaps are listed explicitly.

*Last reviewed: June 2026.*

## 1. Threat model in scope

The application is an invite-only internal tool used by Lummus consultants to participate in a survey workshop programme. Sensitive content includes:

- Personally identifiable info: names, work email addresses.
- Response content authored by participants (potentially candid, opinion-bearing).
- Workshop assignment data (who participates in what).

Out of scope: no payment data, no health records, no consumer-facing endpoints, no third-party data sharing.

## 2. Authentication

| Control | Implementation |
|---|---|
| Identity provider | [Better Auth](https://www.better-auth.com/), email + password, no OAuth / SSO |
| Password hashing | scrypt (Better Auth default — same cost factors as the upstream defaults) |
| Password policy | Minimum 8 characters, enforced server-side at signup and admin reset |
| Session storage | HTTP-only cookie referencing a server-side session row in Postgres |
| Session cookie flags | `HttpOnly`; `Secure` is set automatically on HTTPS origins |
| Session expiry | Default Better Auth lifetime; refreshed on activity |
| Session signing | HMAC-SHA-256 using `BETTER_AUTH_SECRET` (server env var) |
| Self-service password reset | **Not implemented.** Resets are admin-driven (see §4) — explicit design choice to keep the surface small. |
| MFA | **Not implemented.** Documented gap — see §11. |

### Signup

Public signup is blocked at the framework layer (`hooks.server.ts` returns 403 on direct calls to `/api/auth/sign-up/email`). The only legitimate path is `/signup?invite=<code>`, which:

1. Verifies the invite code is present, not yet used, and not expired (server-side `loadInvite()` query).
2. If the invite is email-scoped, refuses signup if the submitted email does not match.
3. Calls Better Auth's `signUpEmail`, marks the invite `used_at = now()` and stores `used_by_user_id`.
4. Optionally applies the invite's pre-assigned `workshop_role` and `workshop_codes` (workshop participation), wrapped in a try/catch so a failure here does not block signup.

Invites are single-use, random 24-byte base64url codes (`crypto.randomBytes(18).toString('base64url')`), generated on the server.

## 3. Authorization

Two-tier role model on `user.role`:

- `admin` — full access to all routes, all data, the admin UI, and the public API.
- `user` — restricted to their own data and to workshops they are explicitly assigned to.

Authorization checks are enforced server-side on **every** `load` function and form action. Two helpers centralise this:

- `requireAdmin(locals)` — used by ~40 admin-only actions across the codebase; returns 403 otherwise.
- `getAccessibleWorkshopIds(user)` (`src/lib/server/access.ts`) — returns the set of workshop IDs a user may see (admin → unrestricted; user with explicit participations → that set; user with none → all by default).

The first user to sign up on a fresh database becomes admin automatically (empty-table check in the Better Auth `databaseHooks.user.create.before`). Subsequent signups are `user`.

### Role-based question filtering

Each question has an optional `target_role` (`PM` / `Engineer` / `IT` / null). Non-admin users only see questions whose `target_role` is null or matches their own `user.workshop_role`. Filtering happens in the SQL `WHERE` clause, not in the UI — bypass via client manipulation is not possible.

## 4. Account management

Admins manage user accounts at `/users`:

- Create invite links with optional email scoping, expiry, pre-assigned role and workshop access.
- Set/reset another user's password (admin types the new password; the server scrypt-hashes it and stores the row in the `account` table via the same Better Auth path used at signup).
- Promote/demote between `admin` and `user`. The signed-in admin cannot demote themselves, blocking lockout.
- Delete a user (cascades sessions, responses, history; sets author refs to null elsewhere). The signed-in admin cannot delete themselves.

All administrative actions check `requireAdmin(locals)` before mutating anything.

## 5. Public API

A single public endpoint is exposed for automation:

- `POST /api/invites` — programmatic invite creation, same data model as the admin UI.

Auth: `Authorization: Bearer $LUMMUS_API_TOKEN`. Implementation notes:

- `LUMMUS_API_TOKEN` is a 32-byte random base64url secret stored as a server env var on Scalingo.
- Comparison uses `crypto.timingSafeEqual` to avoid timing side channels.
- Fail-closed: if the env var is missing the endpoint returns 503 for **every** request — no fallback, no "if token = ''" trap.
- Request body validation: unknown fields are ignored, `ttlDays` is clamped to ≤ 365, workshop codes are validated against the `workshop` table, role is normalised through the same allow-list as the UI.

The hook layer (`src/hooks.server.ts`) exempts `/api/*` from the session-redirect logic so the bearer-token check is the only gate. Bypassing it would require modifying server code.

Rotation procedure: `scalingo env-set LUMMUS_API_TOKEN=<new>` + `scalingo restart`. Documented in `API.md`.

## 6. Data protection

### In transit

- All traffic terminates at Scalingo's HTTPS-only load balancer (TLS 1.2+ negotiated by the platform).
- No HTTP listener exists; Scalingo rewrites or rejects plain HTTP at the edge.
- Database traffic uses `sslmode=prefer` between application dyno and managed Postgres addon.

### At rest

- Postgres data is encrypted at rest at the disk level by Scalingo (platform-managed). The application itself does **not** add a second layer of column-level encryption — see §11.
- Passwords are never stored in plaintext (scrypt; see §2).
- Sessions, account rows, invites: stored as ordinary rows with no extra encryption beyond the disk layer.

### Anonymous responses

The `question_anonymous_response` table stores a `user_id` foreign key, but:

- **No product surface** (admin UI, reports, exports) ever reads or displays this column.
- The column exists solely so that the **author** can review and delete their own anonymous answers.
- This is a documented soft-anonymity trade-off: at the DB level the link exists, but no application code path exposes it to anyone other than the author themselves.
- Older rows (pre-soft-anonymous, before May 2026) have `user_id = NULL` and are truly untraceable.

This is explained in plain language to participants via the in-app warning text and in `USER_GUIDE.md`.

### Personal data inventory

| Field | Where | Visible to |
|---|---|---|
| Name | `user.name` | All authenticated users (Team page if admin) |
| Email | `user.email` | Admins only (Users page) |
| Password (hashed) | `account.password` | Nobody (only used internally for verification) |
| Workshop role | `user.workshop_role` | Admins; user themselves |
| Workshop participations | `workshop_participant` | Admins; user themselves |
| Named responses | `question_response` | Admin (all); user themselves (own only) |
| Anonymous responses | `question_anonymous_response` | Admin (content only, no author); user themselves (own only) |
| Comments | `question_comment` | Admin (all); user themselves (own only) |
| Audit history | `question_history` | Admin only |

There is no analytics tracking, no third-party scripts, and no telemetry data sent off the platform.

## 7. Input handling

- All database queries use [Drizzle ORM](https://orm.drizzle.team/) — every parameter is bound; no string-concatenated SQL exists in the codebase.
- All write actions (`actions` in SvelteKit routes) validate input length, type, and (for enumerated values) membership in an allow-list before any DB write.
- Workshop role / question target role / question status are validated against centralised constants (`src/lib/workshop-roles.ts`, in-file `QUESTION_STATUSES`).
- Markdown / HTML in response bodies is **not rendered** — bodies are displayed as plain text via Svelte's default escaping. No HTML injection risk in user-generated content surfaces.
- Excel uploads (`/roster` import) are parsed in-memory with `exceljs`; only specific cells are read by index. Malformed rows produce non-blocking warnings, not crashes.

## 8. Logging & audit

| What | Where |
|---|---|
| HTTP access logs | Scalingo platform (`scalingo logs`) — 7-day retention by default |
| Application stdout | Same, captured per dyno |
| Authentication events | Better Auth handles login/signup internally; no extra audit log on top |
| Question content changes | `question_history` table: prompt edits, answer edits, status changes, publish toggles, with `actor_user_id` and timestamp. Admin-only. |

The pipeline report (`/reports/pipeline`) provides a comprehensive view of the roster ↔ invitation ↔ registration lifecycle for ops/admin auditing.

## 9. Secrets management

All secrets live in Scalingo environment variables, never in source:

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Signs session tokens. 32-byte base64 random. |
| `BETTER_AUTH_URL` | Canonical origin used by Better Auth (CORS / cookie scope). |
| `LUMMUS_API_TOKEN` | Bearer token for `/api/*`. |
| `DATABASE_URL` | Managed by Scalingo, rotated when the addon is recycled. |

`.env.example` lists the variable names with placeholder values; `.env` is gitignored. No secret has ever been committed (verified by `git log -p | grep -i <secret>` on the relevant strings).

## 10. Operations

### Hosting

- Region: `osc-fr1` (Outscale Paris). All data stays in France.
- Platform: Scalingo, ISO 27001-certified. Detailed sub-processor list: [scalingo.com/security](https://scalingo.com/security).
- Postgres: managed addon, version 16, `starter-512` plan.

### Backups

- Scalingo automated nightly Postgres backups (~02:00 CEST), retained per plan defaults.
- Local mirror: `scripts/backup-from-scalingo.sh` downloads the latest Scalingo backup every day at 09:30 local time on the maintainer's machine via macOS `launchd`. Backups are stored locally (off-platform) for disaster-recovery resilience.
- Ad-hoc dumps before risky migrations: `scripts/backup-prod.sh` via Scalingo SSH tunnel + `pg_dump`.
- Full backup procedure and restore steps: `DATABASE.md` § Backups.

### Deployment

- Source: GitHub `jpbreysse/lummus`, branch `main`.
- Auto-deploy: Scalingo platform pulls + builds on every push to `main`. Build failures block the deploy (the previous release stays in service).
- Pre-deploy hooks: type-checking via `tsc --noEmit` is part of the developer workflow; the deployed image runs `vite build` which would also fail loudly on type-level inconsistencies that the bundler can detect.

### Database migrations

- All schema changes live in `drizzle/migrations-manual/*.sql`. Applied manually through the Scalingo tunnel; never auto-run at deploy time. This avoids a class of migration-related outages.

## 11. Known gaps / future work

Listed explicitly so reviewers don't have to find them.

| Gap | Risk | Mitigation today |
|---|---|---|
| No MFA | Account takeover via leaked password | Invite-only signup limits exposure; admins are a small set of internal staff |
| No self-service password reset | Operational, not security | Admin can reset on request (`/users` → key icon) |
| No rate limiting on `/login` or `/api/invites` | Brute-force feasibility | Better Auth's defaults; bearer token has 256 bits of entropy |
| Anonymous responses are soft-anonymous, not cryptographically anonymous | A DB-level admin (e.g. someone with `pg_dump` access) could correlate | Explicitly documented to users; no product surface exposes the link |
| No column-level encryption beyond disk | Comparable to industry default for low-sensitivity content | Acceptable given the data inventory in §6 |
| No formal vulnerability scanning / SBOM | Unknown CVE exposure in dependencies | `npm audit` is run periodically; dependency surface is small (~265 packages, mostly framework) |
| No CSP / strict HSTS headers defined in app code | XSS hardening relies on Svelte's default escaping | Open to adding; would require a careful audit since the app does not currently use inline scripts |

## 12. Reporting a vulnerability

Email Jean-Philippe Breysse at `jeanphilbreysse@gmail.com` with the subject "Lummus security report". Do not file a public GitHub issue.

We aim to triage within 3 business days and disclose / fix critical issues before any wider communication.
