/**
 * Canonical list of workshop roles.
 *
 * Stored as plain text on `user.workshop_role`, `question.target_role`
 * and `invite.workshop_role`. This file is the only place new roles
 * should be added — UI dropdowns and server-side validation both import
 * from here so they stay in sync.
 */
export const WORKSHOP_ROLES = ['PM', 'Engineer', 'IT'] as const;

export type WorkshopRole = (typeof WORKSHOP_ROLES)[number];

/** Narrow an arbitrary string to a known WorkshopRole, or null. */
export function parseWorkshopRole(value: unknown): WorkshopRole | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return (WORKSHOP_ROLES as readonly string[]).includes(trimmed)
		? (trimmed as WorkshopRole)
		: null;
}
