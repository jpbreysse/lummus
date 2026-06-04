import { db } from '$lib/server/db';
import { user, session, invite, account, workshopParticipant, workshop } from '$lib/server/db/schema';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { parseWorkshopRole } from '$lib/workshop-roles';
import type { Actions, PageServerLoad } from './$types';

function generateCode() {
	return randomBytes(18).toString('base64url');
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admins only');
	}

	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image,
			role: user.role,
			workshopRole: user.workshopRole,
			createdAt: user.createdAt,
			sessions: sql<number>`(select count(*)::int from ${session} where ${session.userId} = ${user.id} and ${session.expiresAt} > now())`,
			accessCodes: sql<string[]>`coalesce((
				select array_agg(distinct w.code order by w.code)
				from workshop_participant wp
				join workshop w on w.id = wp.workshop_id
				where wp.user_id = "user"."id"
			), '{}')`
		})
		.from(user)
		.orderBy(desc(user.createdAt));

	const invites = await db
		.select({
			id: invite.id,
			code: invite.code,
			email: invite.email,
			workshopRole: invite.workshopRole,
			workshopCodes: invite.workshopCodes,
			createdAt: invite.createdAt,
			expiresAt: invite.expiresAt,
			usedAt: invite.usedAt,
			usedByName: user.name
		})
		.from(invite)
		.leftJoin(user, eq(user.id, invite.usedByUserId))
		.orderBy(desc(invite.createdAt));

	// All workshops, exposed to the Create invite dialog so the admin
	// can pre-assign access by ticking codes.
	const workshops = await db
		.select({ code: workshop.code, title: workshop.title, weekNumber: workshop.weekNumber })
		.from(workshop)
		.orderBy(asc(workshop.weekNumber));

	return { users, invites, workshops, currentUserId: locals.user?.id ?? null };
};

const requireAdmin = (locals: App.Locals) => locals.user?.role === 'admin';

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = form.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing id' });
		if (locals.user && id === locals.user.id) {
			return fail(400, { error: 'Cannot delete your own account' });
		}
		await db.delete(user).where(eq(user.id, id));
		return { ok: true };
	},

	resetPassword: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = form.get('id')?.toString();
		const password = form.get('password')?.toString() ?? '';
		if (!id) return fail(400, { error: 'Missing id' });
		if (password.length < 8) return fail(400, { error: 'Password must be at least 8 characters' });

		const hashed = await hashPassword(password);
		const [existing] = await db
			.select({ id: account.id })
			.from(account)
			.where(and(eq(account.userId, id), eq(account.providerId, 'credential')))
			.limit(1);

		if (existing) {
			await db
				.update(account)
				.set({ password: hashed, updatedAt: new Date() })
				.where(eq(account.id, existing.id));
		} else {
			await db.insert(account).values({
				id: randomBytes(16).toString('hex'),
				accountId: id,
				providerId: 'credential',
				userId: id,
				password: hashed
			});
		}
		return { ok: true };
	},

	setRole: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = form.get('id')?.toString();
		const role = form.get('role')?.toString();
		if (!id || (role !== 'admin' && role !== 'user')) {
			return fail(400, { error: 'Invalid' });
		}
		if (locals.user && id === locals.user.id && role === 'user') {
			return fail(400, { error: 'Cannot demote yourself' });
		}
		await db.update(user).set({ role }).where(eq(user.id, id));
		return { ok: true };
	},

	setUserWorkshops: async ({ request, locals }) => {
		// Replace the set of workshop_participant rows for one user with
		// the codes the admin ticked. Empty list = no participation rows,
		// which falls back to "all workshops" per the access.ts default.
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const userId = form.get('id')?.toString();
		if (!userId) return fail(400, { error: 'Missing user id' });

		const codes = form
			.getAll('codes')
			.map((c) => c.toString().trim())
			.filter(Boolean);

		const [u] = await db
			.select({ id: user.id, role: user.role })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!u) return fail(404, { error: 'User not found' });

		let workshopIds: number[] = [];
		if (codes.length) {
			const existing = await db
				.select({ id: workshop.id, code: workshop.code })
				.from(workshop)
				.where(inArray(workshop.code, codes));
			const valid = new Set(existing.map((e) => e.code));
			const unknown = codes.filter((c) => !valid.has(c));
			if (unknown.length) {
				return fail(400, { error: `Unknown workshop code(s): ${unknown.join(', ')}` });
			}
			workshopIds = existing.map((e) => e.id);
		}

		// Replace participations atomically so the admin never sees a
		// partial state mid-update.
		await db.transaction(async (tx) => {
			await tx.delete(workshopParticipant).where(eq(workshopParticipant.userId, userId));
			if (workshopIds.length) {
				await tx
					.insert(workshopParticipant)
					.values(workshopIds.map((wid) => ({ workshopId: wid, userId })));
			}
		});
		return { ok: true };
	},

	setWorkshopRole: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = form.get('id')?.toString();
		// Empty string from the dropdown means "unset" → store NULL
		const workshopRole = parseWorkshopRole(form.get('workshopRole'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.update(user).set({ workshopRole }).where(eq(user.id, id));
		return { ok: true };
	},

	createInvite: async ({ request, locals, url }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const email = form.get('email')?.toString().trim().toLowerCase() || null;
		const ttlDays = Number(form.get('ttlDays')) || 7;

		const workshopRole = parseWorkshopRole(form.get('workshopRole'));

		// workshopCodes arrive as multiple form values with the same name.
		// Empty list = no pre-assigned access (signup falls back to default).
		const codesRaw = form.getAll('workshopCodes').map((v) => v.toString().trim()).filter(Boolean);
		const workshopCodes = codesRaw.length ? codesRaw : null;

		const code = generateCode();
		const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

		await db.insert(invite).values({
			code,
			email,
			workshopRole,
			workshopCodes,
			createdByUserId: locals.user?.id ?? null,
			expiresAt
		});

		const signupUrl = `${url.origin}/signup?invite=${code}`;
		return { ok: true, inviteUrl: signupUrl };
	},

	deleteInvite: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(invite).where(eq(invite.id, id));
		return { ok: true };
	},

	renewInvite: async ({ request, locals }) => {
		// Bumps an invite's expires_at forward without changing the code,
		// so any link the admin already shared (e.g. by email) keeps working.
		// Used invites cannot be renewed — they're single-use by design.
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		const ttlDaysRaw = Number(form.get('ttlDays'));
		const ttlDays =
			Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 && ttlDaysRaw <= 365 ? ttlDaysRaw : 14;
		if (!id) return fail(400, { error: 'Missing id' });

		const [row] = await db
			.select({ usedAt: invite.usedAt })
			.from(invite)
			.where(eq(invite.id, id))
			.limit(1);
		if (!row) return fail(404, { error: 'Not found' });
		if (row.usedAt) {
			return fail(400, { error: 'This invite has been used — create a new one instead' });
		}

		const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
		await db.update(invite).set({ expiresAt }).where(eq(invite.id, id));
		return { ok: true };
	}
};
