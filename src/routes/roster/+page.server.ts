import { db } from '$lib/server/db';
import { rosterEntry, user, invite, workshop } from '$lib/server/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { parseRosterWorkbook } from '$lib/server/roster-parser';
import type { Actions, PageServerLoad } from './$types';

function generateCode() {
	return randomBytes(18).toString('base64url');
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') throw error(403, 'Admins only');

	const roster = await db.select().from(rosterEntry).orderBy(asc(rosterEntry.name));

	// All users we might match against. Lower-cased email so the diff is
	// case-insensitive.
	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			workshopRole: user.workshopRole
		})
		.from(user);

	const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

	// Most-recent open invite per email (so the admin can copy the URL
	// or know one's already been sent).
	const openInvitesRaw = await db
		.select({
			id: invite.id,
			code: invite.code,
			email: invite.email,
			usedAt: invite.usedAt,
			expiresAt: invite.expiresAt,
			createdAt: invite.createdAt
		})
		.from(invite);
	const inviteByEmail = new Map<string, (typeof openInvitesRaw)[number]>();
	for (const inv of openInvitesRaw) {
		if (!inv.email || inv.usedAt) continue;
		const key = inv.email.toLowerCase();
		const prev = inviteByEmail.get(key);
		if (!prev || inv.createdAt > prev.createdAt) inviteByEmail.set(key, inv);
	}

	const entries = roster.map((r) => {
		const matched = userByEmail.get(r.email);
		const inv = inviteByEmail.get(r.email);
		return {
			...r,
			registered: !!matched,
			matchedUserId: matched?.id ?? null,
			matchedRole: matched?.workshopRole ?? null,
			openInviteCode: inv?.code ?? null
		};
	});

	// "Extras" — registered users whose email is not in the roster.
	// Admins are excluded since they're not the surveyed population.
	const rosterEmails = new Set(roster.map((r) => r.email));
	const extras = users.filter(
		(u) => u.role !== 'admin' && !rosterEmails.has(u.email.toLowerCase())
	);

	const counts = {
		total: entries.length,
		registered: entries.filter((e) => e.registered).length,
		pending: entries.filter((e) => !e.registered).length,
		extras: extras.length
	};

	return { entries, extras, counts };
};

const requireAdmin = (locals: App.Locals) => locals.user?.role === 'admin';

export const actions: Actions = {
	import: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });

		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Pick an .xlsx file' });
		}

		let parsed;
		try {
			const ab = await file.arrayBuffer();
			parsed = await parseRosterWorkbook(ab);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fail(400, { error: `Could not read the file: ${msg}` });
		}

		if (!parsed.rows.length) {
			return fail(400, {
				error: 'No usable rows found. Check the sheet name and column layout.'
			});
		}

		// Upsert by email — idempotent re-imports.
		const importedBy = locals.user?.id ?? null;
		const now = new Date();
		for (const r of parsed.rows) {
			await db
				.insert(rosterEntry)
				.values({
					name: r.name,
					email: r.email,
					workshopRole: r.workshopRole,
					workshopCodes: r.workshopCodes,
					importedAt: now,
					importedByUserId: importedBy
				})
				.onConflictDoUpdate({
					target: rosterEntry.email,
					set: {
						name: r.name,
						workshopRole: r.workshopRole,
						workshopCodes: r.workshopCodes,
						importedAt: now,
						importedByUserId: importedBy
					}
				});
		}

		return { ok: true, imported: parsed.rows.length, warnings: parsed.warnings };
	},

	createInviteForEntry: async ({ request, locals, url }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });

		const [row] = await db
			.select()
			.from(rosterEntry)
			.where(eq(rosterEntry.id, id))
			.limit(1);
		if (!row) return fail(404, { error: 'Roster entry not found' });

		// Reject if the roster entry references unknown workshop codes.
		// This stops a silent "invite created but participant rows missing".
		if (row.workshopCodes && row.workshopCodes.length) {
			const existing = await db
				.select({ code: workshop.code })
				.from(workshop)
				.where(inArray(workshop.code, row.workshopCodes));
			const valid = new Set(existing.map((e) => e.code));
			const unknown = row.workshopCodes.filter((c) => !valid.has(c));
			if (unknown.length) {
				return fail(400, { error: `Unknown workshop code(s): ${unknown.join(', ')}` });
			}
		}

		const code = generateCode();
		const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

		await db.insert(invite).values({
			code,
			email: row.email,
			workshopRole: row.workshopRole,
			workshopCodes: row.workshopCodes,
			createdByUserId: locals.user?.id ?? null,
			expiresAt
		});

		return {
			ok: true,
			inviteUrl: `${url.origin}/signup?invite=${code}`,
			email: row.email
		};
	},

	deleteEntry: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(rosterEntry).where(eq(rosterEntry.id, id));
		return { ok: true };
	},

	clearAll: async ({ locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		await db.delete(rosterEntry);
		return { ok: true };
	}
};

