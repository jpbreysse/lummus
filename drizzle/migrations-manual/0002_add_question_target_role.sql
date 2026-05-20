-- Add target_role to question table.
-- NULL = shown to all participants (default).
-- 'PM' / 'Engineer' = shown only to participants whose workshopRole matches.

ALTER TABLE question ADD COLUMN target_role text;

-- Auto-tag existing W1 questions that already embed role hints in their prompt.
-- Rules:
--   prompt contains '(PM)'       → PM only          (unless it also says 'both roles')
--   prompt contains '(Engineer)' → Engineer only     (unless it also says 'both roles')
--   prompt contains '(both'      → stays NULL (all)

UPDATE question
SET target_role = 'PM'
WHERE prompt LIKE '%(PM)%'
  AND prompt NOT LIKE '%(both%';

UPDATE question
SET target_role = 'Engineer'
WHERE prompt LIKE '%(Engineer)%'
  AND prompt NOT LIKE '%(both%';
