# Lummus

SvelteKit fullstack app tracking the Lummus Phase 2 implementation: workshops, team, questions, and hours.

## Stack
- SvelteKit + Svelte 5 (TypeScript)
- Tailwind CSS v4 + shadcn-svelte
- PostgreSQL + Drizzle ORM (`postgres.js` driver)

## Setup

1. Create a local database:
   ```sh
   createdb lummus
   ```
2. Copy env and adjust credentials if needed:
   ```sh
   cp .env.example .env
   ```
3. Install and push schema:
   ```sh
   npm install
   npm run db:push
   ```
4. Run the dev server:
   ```sh
   npm run dev -- --open
   ```

## Scripts
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run check` — type-check
- `npm run db:push` — sync schema to DB (dev)
- `npm run db:generate` — generate migrations
- `npm run db:migrate` — apply migrations
- `npm run db:studio` — open Drizzle Studio

## Project layout
```
src/
├── lib/
│   ├── components/ui/      # shadcn-svelte components
│   ├── server/db/          # Drizzle schema + client
│   └── utils.ts
└── routes/                 # Pages + server routes (+server.ts)
```

## Schema (src/lib/server/db/schema.ts)
- `workshop` — programme sessions (code, title, status, week, duration)
- `team_member` — participants (name, role, org)
- `workshop_participant` — join table
- `question` — per-workshop questions (prompt, answer, status)
- `hours_entry` — effort log (workshop, member, kind, hours)
