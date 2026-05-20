-- Soft-anonymize anonymous responses.
--
-- Before: question_anonymous_response stored only body+timestamp, with no
-- link back to the author. Truly untraceable, but the user themselves
-- could not see their own past anonymous responses across sessions.
--
-- After: a nullable user_id column is added so the user can see their own
-- anonymous responses in the future. The admin UI still does NOT show
-- this link — author identity remains hidden in product surfaces, but
-- technically a DB-level query could trace it. This trade-off is
-- documented in USER_GUIDE.md.
--
-- Existing rows keep user_id = NULL (they remain truly anonymous).

ALTER TABLE question_anonymous_response
	ADD COLUMN user_id text REFERENCES "user"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS question_anonymous_response_user_idx
	ON question_anonymous_response (user_id);
