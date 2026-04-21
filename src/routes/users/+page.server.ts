import { db } from '$lib/server/db';
import { user, session, invite } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

function generateCode() {
	return randomBytes(18).toString('base64url');
}

export const load: PageServerLoad = async ({ locals }) => {
	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image,
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

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const id = form.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing id' });
		if (locals.user && id === locals.user.id) {
			return fail(400, { error: 'Cannot delete your own account' });
		}
		await db.delete(user).where(eq(user.id, id));
		return { ok: true };
	},

	createInvite: async ({ request, locals, url }) => {
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

	deleteInvite: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(invite).where(eq(invite.id, id));
		return { ok: true };
	}
};
