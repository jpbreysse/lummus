import { db } from '$lib/server/db';
import { user, session, invite, account } from '$lib/server/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
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
			createdAt: user.createdAt,
			sessions: sql<number>`(select count(*)::int from ${session} where ${session.userId} = ${user.id} and ${session.expiresAt} > now())`
		})
		.from(user)
		.orderBy(desc(user.createdAt));

	const invites = await db
		.select({
			id: invite.id,
			code: invite.code,
			email: invite.email,
			createdAt: invite.createdAt,
			expiresAt: invite.expiresAt,
			usedAt: invite.usedAt,
			usedByName: user.name
		})
		.from(invite)
		.leftJoin(user, eq(user.id, invite.usedByUserId))
		.orderBy(desc(invite.createdAt));

	return { users, invites, currentUserId: locals.user?.id ?? null };
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

	createInvite: async ({ request, locals, url }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const email = form.get('email')?.toString().trim().toLowerCase() || null;
		const ttlDays = Number(form.get('ttlDays')) || 7;

		const code = generateCode();
		const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

		await db.insert(invite).values({
			code,
			email,
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
	}
};
