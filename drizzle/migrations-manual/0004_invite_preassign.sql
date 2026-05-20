-- Pre-assign workshop role and workshop access at invite creation.
--
-- When the user later accepts the invite and signs up, /signup applies:
--   - workshop_role → user.workshop_role
--   - workshop_codes (text[]) → one workshop_participant row per matching workshop
--
-- Both fields are nullable. NULL workshop_role = no role pre-assigned.
-- NULL or empty workshop_codes = no access pre-assigned (user defaults to
-- "all workshops" per the existing access rule).

ALTER TABLE invite ADD COLUMN workshop_role text;
ALTER TABLE invite ADD COLUMN workshop_codes text[];
