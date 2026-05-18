import { db } from './db';
import { workshopParticipant } from './db/schema';
import { eq } from 'drizzle-orm';

/**
 * Returns the set of workshop IDs a user is allowed to see, or `null`
 * meaning "no restrictions, all workshops accessible".
 *
 * Rules:
 * - Admins → null (full access)
 * - Standard user with at least one `workshop_participant` row → Set of those workshop IDs (whitelist)
 * - Standard user with no participant rows → null (default: full access)
 *
 * Being a participant of a workshop is what grants access.
 */
export async function getAccessibleWorkshopIds(
	user: { id: string; role: 'admin' | 'user' } | null
): Promise<Set<number> | null> {
	if (!user) return new Set(); // unauthenticated: nothing accessible (defensive)
	if (user.role === 'admin') return null;

	const rows = await db
		.select({ workshopId: workshopParticipant.workshopId })
		.from(workshopParticipant)
		.where(eq(workshopParticipant.userId, user.id));

	if (rows.length === 0) return null; // not a participant → default to all
	return new Set(rows.map((r) => r.workshopId));
}

export function canAccessWorkshop(
	accessibleIds: Set<number> | null,
	id: number
): boolean {
	return accessibleIds === null || accessibleIds.has(id);
}
