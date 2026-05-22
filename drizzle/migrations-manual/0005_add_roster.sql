-- Persistent roster of expected users.
--
-- The admin imports an Excel from an upstream source ("LCI user
-- assignments for surveys") and the /roster page perpetually shows who
-- has registered (matched by email) vs who is still pending.
--
-- Email is the join key; stored lower-cased and unique so re-imports
-- are idempotent (we UPSERT on email).
--
-- workshop_role + workshop_codes mirror the invite table so a one-click
-- "send invite" can replay the roster's pre-assignment on signup.

CREATE TABLE roster_entry (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	workshop_role TEXT,
	workshop_codes TEXT[],
	imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	imported_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX roster_entry_email_idx ON roster_entry (email);
