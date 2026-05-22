import { db } from '$lib/server/db';
import { rosterEntry, user, invite } from '$lib/server/db/schema';
import { asc, desc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Cross-table pipeline: roster ↔ invites ↔ registrations, keyed on email.
 *
 * Each output row is the union of what is known about one email across
 * the three sources. The `status` field is the derived state used by the
 * UI to colour-code and filter.
 */

type InviteState = 'used' | 'open' | 'expired';
type Status =
	| 'registered' // in roster + has user (any invite state) → success
	| 'mismatch' // in roster + has user but app role/access differs from roster
	| 'invited' // in roster + open invite, no user yet
	| 'expired' // in roster + only expired invites, no user
	| 'action_needed' // in roster, no invite, no user
	| 'extra' // user without roster (non-admin)
	| 'orphan_invite'; // invite without roster and without user

interface InviteRow {
	id: number;
	code: string;
	createdAt: Date;
	expiresAt: Date | null;
	usedAt: Date | null;
	state: InviteState;
}

interface PipelineRow {
	email: string;
	name: string;
	status: Status;
	roster: { workshopRole: string | null; workshopCodes: string[] | null } | null;
	user: {
		id: string;
		role: 'admin' | 'user';
		workshopRole: string | null;
		createdAt: Date;
	} | null;
	invites: InviteRow[];
	roleMismatch: boolean;
}

function classifyInvite(inv: {
	expiresAt: Date | null;
	usedAt: Date | null;
}): InviteState {
	if (inv.usedAt) return 'used';
	if (inv.expiresAt && inv.expiresAt < new Date()) return 'expired';
	return 'open';
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') throw error(403, 'Admins only');

	const [roster, users, invites] = await Promise.all([
		db.select().from(rosterEntry).orderBy(asc(rosterEntry.email)),
		db
			.select({
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
				workshopRole: user.workshopRole,
				createdAt: user.createdAt
			})
			.from(user),
		db
			.select({
				id: invite.id,
				code: invite.code,
				email: invite.email,
				workshopRole: invite.workshopRole,
				workshopCodes: invite.workshopCodes,
				createdAt: invite.createdAt,
				expiresAt: invite.expiresAt,
				usedAt: invite.usedAt
			})
			.from(invite)
			.orderBy(desc(invite.createdAt))
	]);

	// Index everything by lower-cased email.
	const rosterByEmail = new Map(roster.map((r) => [r.email.toLowerCase(), r]));
	const usersByEmail = new Map<string, (typeof users)[number]>();
	for (const u of users) usersByEmail.set(u.email.toLowerCase(), u);
	const invitesByEmail = new Map<string, InviteRow[]>();
	for (const inv of invites) {
		if (!inv.email) continue; // Open invites (no targeted email) aren't pipeline events.
		const key = inv.email.toLowerCase();
		const list = invitesByEmail.get(key) ?? [];
		list.push({
			id: inv.id,
			code: inv.code,
			createdAt: inv.createdAt,
			expiresAt: inv.expiresAt,
			usedAt: inv.usedAt,
			state: classifyInvite(inv)
		});
		invitesByEmail.set(key, list);
	}

	const allEmails = new Set<string>([
		...rosterByEmail.keys(),
		...usersByEmail.keys(),
		...invitesByEmail.keys()
	]);

	const rows: PipelineRow[] = [];

	for (const email of allEmails) {
		const r = rosterByEmail.get(email) ?? null;
		const u = usersByEmail.get(email) ?? null;
		const invs = invitesByEmail.get(email) ?? [];

		// Skip admin extras — they're not part of the surveyed population.
		if (!r && u?.role === 'admin') continue;

		const name = u?.name || r?.name || email;

		let roleMismatch = false;
		let status: Status;

		if (r && u) {
			roleMismatch = (r.workshopRole ?? null) !== (u.workshopRole ?? null);
			status = roleMismatch ? 'mismatch' : 'registered';
		} else if (!r && u) {
			status = 'extra';
		} else if (r && !u) {
			const open = invs.some((i) => i.state === 'open');
			const anyInvite = invs.length > 0;
			if (open) status = 'invited';
			else if (anyInvite) status = 'expired';
			else status = 'action_needed';
		} else {
			// no roster, no user, has invite(s)
			status = 'orphan_invite';
		}

		rows.push({
			email,
			name,
			status,
			roster: r
				? { workshopRole: r.workshopRole, workshopCodes: r.workshopCodes }
				: null,
			user: u
				? {
						id: u.id,
						role: u.role,
						workshopRole: u.workshopRole,
						createdAt: u.createdAt
					}
				: null,
			invites: invs,
			roleMismatch
		});
	}

	// Default sort: status priority, then name. Worst → best so the
	// admin sees what needs action at the top.
	const statusOrder: Record<Status, number> = {
		mismatch: 0,
		action_needed: 1,
		expired: 2,
		invited: 3,
		extra: 4,
		orphan_invite: 5,
		registered: 6
	};
	rows.sort((a, b) => {
		const d = statusOrder[a.status] - statusOrder[b.status];
		if (d !== 0) return d;
		return a.name.localeCompare(b.name);
	});

	const counts = {
		total: rows.length,
		registered: rows.filter((r) => r.status === 'registered').length,
		mismatch: rows.filter((r) => r.status === 'mismatch').length,
		invited: rows.filter((r) => r.status === 'invited').length,
		expired: rows.filter((r) => r.status === 'expired').length,
		action_needed: rows.filter((r) => r.status === 'action_needed').length,
		extra: rows.filter((r) => r.status === 'extra').length,
		orphan_invite: rows.filter((r) => r.status === 'orphan_invite').length,
		rosterTotal: roster.length,
		usersTotal: users.filter((u) => u.role !== 'admin').length,
		invitesTotal: invites.length
	};

	return { rows, counts };
};
