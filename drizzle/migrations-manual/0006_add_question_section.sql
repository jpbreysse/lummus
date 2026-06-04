-- Optional section / block grouping for questions inside a workshop.
--
-- Workshops can have a logical grouping of questions (e.g. "Block 1 —
-- Activity inventory"). When set, the workshop page renders the section
-- name as a divider above the first question that belongs to it.
-- NULL = no section, question is rendered without a group header.
--
-- No backfill — every existing question stays NULL until updated.

ALTER TABLE question ADD COLUMN section text;
