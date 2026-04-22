# Architecture — SvelteKit admin app blueprint

This document captures the architectural conventions used in the Lummus tracker so they can be reproduced for a new business domain. Read this file, then fill out `DOMAIN.md` for your new app, then ask Claude to generate it following these patterns.

## Stack

- **SvelteKit** (Node.js ≥ 20) + **Svelte 5 runes** (`$state`, `$derived`, `$props`)
- **TypeScript** everywhere
- **Tailwind CSS v4** (`@import 'tailwindcss'` in `src/routes/layout.css`)
- **shadcn-svelte** for UI primitives (buttons, cards, dialog, table, input, textarea, badge, progress, separator, sonner)
- **Lucide Svelte** for icons (`@lucide/svelte/icons/<name>`)
- **Drizzle ORM** + **postgres.js** driver
- **Better Auth** (email + password, sessions, invite-only signup, custom role field)
- **@sveltejs/adapter-node** (production build → `build/index.js`, reads `PORT` env)
- Deploy target: **Scalingo** (Postgres addon → aliased via `DATABASE_URL=$SCALINGO_POSTGRESQL_URL`)

## Folder layout

```
src/
├── app.d.ts                  # Locals.user augmented with { role }
├── app.html
├── hooks.server.ts           # Auth handler + signup blocker + guard
├── lib/
│   ├── auth-client.ts        # authClient for client-side sign-in/out
│   ├── server/
│   │   ├── auth.ts           # Better Auth config with databaseHook
│   │   └── db/
│   │       ├── index.ts      # drizzle(postgres(DATABASE_URL))
│   │       ├── schema.ts     # all tables + enums + relations
│   │       └── seed.ts       # one-off CLI seed script (npm run db:seed)
│   ├── components/ui/        # shadcn-svelte components
│   └── utils.ts              # cn() helper
└── routes/
    ├── +layout.svelte        # Sidebar nav (hidden on /login and /signup)
    ├── +layout.server.ts     # Exposes { user } to client
    ├── login/                # Sign-in only (no signup toggle)
    ├── signup/               # Invite-required; validates in load() + action
    ├── <entity>/             # List page + server load + actions
    └── <entity>/[id_or_code]/ # Detail page + server load + actions
```

## Routing conventions

- **Load in `+page.server.ts`** always — never `+page.ts` for anything with DB access
- **Actions** live alongside load in `+page.server.ts`. Name them verbosely: `updateWorkshop`, `addQuestion`, `deleteHours`. Admin-gated actions start with a `requireAdmin(locals)` check.
- **Detail pages** use a slug in brackets: `/workshops/[code]`, not `/workshops/[id]`, when the entity has a human-readable code (`W1`, `W2`…). Plain numeric ids are OK when there's no natural code.
- **List pages** are flat (no cards-inside-grids-inside-accordions). Use a simple `<div class="grid gap-6 lg:grid-cols-2">` for card grids.

## Auth (invite-only, role-aware)

**Signup is NEVER public.** Two mechanisms together block direct signup and enforce invites:

1. **hooks.server.ts** intercepts `POST /api/auth/sign-up/email` and returns 403 with message "Signup is invite-only". This stops anyone from hitting Better Auth's endpoint directly.
2. **`/signup?invite=CODE`** is the only legitimate path. It validates the code, calls `auth.api.signUpEmail` server-side, marks the invite as used, and forwards the `Set-Cookie` header back to the client.

```ts
// hooks.server.ts pattern
const blockPublicSignUp: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/api/auth/sign-up/email' && event.request.method === 'POST') {
		return json({ message: 'Signup is invite-only.' }, { status: 403 });
	}
	return resolve(event);
};
```

**First signup becomes admin** automatically via Better Auth's `databaseHooks.user.create.before`:

```ts
databaseHooks: {
	user: {
		create: {
			before: async (data) => {
				const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.user);
				return { data: { ...data, role: count === 0 ? 'admin' : 'user' } };
			}
		}
	}
}
```

**Role enrichment in hooks** — Better Auth's `getSession` doesn't include custom fields by default. After `getSession`, re-query the DB for `user.role` and attach to `locals.user`:

```ts
const session = await auth.api.getSession({ headers: event.request.headers });
if (session?.user) {
	const [row] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, session.user.id)).limit(1);
	event.locals.user = { ...session.user, role: row?.role ?? 'user' };
}
```

**Gate actions, not just pages.** UI can hide buttons, but actions must independently check:

```ts
const requireAdmin = (locals: App.Locals) => locals.user?.role === 'admin';
// ... in every admin-only action:
if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
```

## Role-based visibility patterns

Three patterns for per-entity-type access control:

| Pattern | Example | Implementation |
|---|---|---|
| **Admin-only read** | `/users` page | `throw error(403)` in load if not admin |
| **Conditional field visibility** | `question.answer` | `{ ...q, answer: isAdmin ? q.answer : null }` after load |
| **Per-user private data** | `question_response` | Filter by `userId` in WHERE clause for non-admins; admins read all |

For **per-user private data**, the canonical schema shape:

```ts
pgTable('thing_response', {
	id: serial('id').primaryKey(),
	thingId: integer('thing_id').notNull().references(() => thing.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	body: text('body').notNull(),
	createdAt, updatedAt
},
(t) => [index('thing_response_unique').on(t.thingId, t.userId)]
);
```

One row per (thing, user). Upsert in the `saveResponse` action.

## Form patterns

Every mutation goes through a SvelteKit form action with `use:enhance`. Never call `fetch` from the client for your own mutations.

**Standard enhance callback:**

```svelte
<form
	method="POST"
	action="?/updateThing"
	use:enhance={() => {
		return async ({ update }) => {
			await update();
			await invalidateAll();
		};
	}}
>
	<input type="hidden" name="id" value={thing.id} />
	<Input name="title" value={thing.title} required />
	<Button type="submit">Save</Button>
</form>
```

**Auto-submit on change** (dropdowns that save immediately):

```svelte
<select onchange={(e) => e.currentTarget.form.requestSubmit()} ...>
```

**Avoid nested forms** — Svelte will warn about SSR hydration mismatch. If a row has both "save" and "delete", they must be sibling forms, not nested.

**Inline success feedback** — use a `$state<Record<string, number>>` keyed by entity id to show a transient "✓ saved" for ~1.5s after a successful action.

## UI conventions

- **Layout**: sidebar `w-56` on left, main content in `<main class="flex-1 min-w-0">`. Pages use `<div class="max-w-7xl px-8 py-8">` (no `mx-auto` — content left-anchored to the sidebar).
- **Reading pages** (announcements, long prose): `max-w-4xl` instead.
- **Sidebar hides admin-only links** for non-admins via `$derived` nav list.
- **Status colors**: emerald for "done/answered", amber for "in progress", muted for "upcoming". Use lucide `circle-check` / `circle-dot` / `circle` matching colors.
- **Card grids** for entity lists: `grid gap-6 lg:grid-cols-2`. Tables for denser data (team, questions, users).
- **Progress bars**: `h-2` (not h-1.5 — too thin). Use shadcn `<Progress>`.
- **Date formatting**: `toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })` — respects user locale.

## Environment + deploy

`.env` (not committed, but `.env.example` is):

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/dbname
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:5174
```

**On Scalingo**:
- `scalingo create <app>` + `scalingo addons-add postgresql postgresql-sandbox`
- `scalingo env-set BETTER_AUTH_SECRET=$(openssl rand -base64 32)`
- `scalingo env-set BETTER_AUTH_URL=https://<app>.osc-fr1.scalingo.io`
- `scalingo env-set 'DATABASE_URL=$SCALINGO_POSTGRESQL_URL'` (single-quoted — Scalingo resolves at runtime)
- `git push scalingo main`
- Schema push via db-tunnel: `scalingo db-tunnel SCALINGO_POSTGRESQL_URL` then `DATABASE_URL="<tunnel-url>" npx drizzle-kit push --force`
- Bootstrap first user via `scripts/create-user.ts` through the tunnel (auto-promoted to admin by the hook)

## Scripts

```json
"scripts": {
	"dev": "vite dev",
	"build": "vite build",
	"start": "node build",
	"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
	"db:push": "drizzle-kit push",
	"db:generate": "drizzle-kit generate",
	"db:migrate": "drizzle-kit migrate",
	"db:studio": "drizzle-kit studio",
	"db:seed": "tsx src/lib/server/db/seed.ts"
}
```

`"engines": { "node": ">=20" }` is required for Scalingo.

## Non-obvious gotchas

- Better Auth's `disableSignUp: true` also blocks server-side `auth.api.signUpEmail`, so we can't use it for invite-only. Block the HTTP endpoint in `hooks.server.ts` instead.
- Better Auth's `trustedOrigins` must include every host the browser uses (including `127.0.0.1` if you dev on it). `localhost:5174` ≠ `127.0.0.1:5174`.
- Scalingo's build process runs with `NPM_CONFIG_PRODUCTION=false` by default, so devDependencies install fine. No need to move Vite/Drizzle/etc. to `dependencies`.
- Adapter-node bundles everything via Vite's SSR build. Runtime imports in `build/` are node builtins only — no `node_modules` lookups at runtime.
- When passing secrets from `.env` to auth config, use `$env/dynamic/private`, NOT `process.env` — the latter isn't populated during `vite build` and causes "missing secret" errors at build time.
- `drizzle-kit push` is interactive by default — always use `--force` in non-TTY environments (tunnels, scripts).
