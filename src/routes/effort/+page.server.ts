import { db } from '$lib/server/db';
import { effortLog, user } from '$lib/server/db/schema';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const requireAdmin = (locals: App.Locals) => locals.user?.role === 'admin';

export const load: PageServerLoad = async ({ locals }) => {
	if (!requireAdmin(locals)) throw error(403, 'Admins only');

	const entries = await db
		.select({
			id: effortLog.id,
			date: effortLog.date,
			description: effortLog.description,
			hours: effortLog.hours,
			createdAt: effortLog.createdAt,
			userId: effortLog.userId,
			userName: user.name
		})
		.from(effortLog)
		.leftJoin(user, eq(user.id, effortLog.userId))
		.orderBy(desc(effortLog.date), desc(effortLog.id));

	const [{ total }] = await db
		.select({ total: sql<string>`coalesce(sum(${effortLog.hours}), 0)` })
		.from(effortLog);

	const users = await db
		.select({ id: user.id, name: user.name })
		.from(user)
		.orderBy(asc(user.name));

	return { entries, total: Number(total), users };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const dateRaw = form.get('date')?.toString().trim();
		const description = form.get('description')?.toString().trim();
		const hours = form.get('hours')?.toString().trim();
		const userId = form.get('userId')?.toString().trim() || null;

		if (!description || !hours) return fail(400, { error: 'Description and hours required' });
		const date = dateRaw ? new Date(dateRaw) : new Date();
		if (isNaN(date.getTime())) return fail(400, { error: 'Invalid date' });

		await db.insert(effortLog).values({
			date,
			description,
			hours,
			userId: userId || locals.user?.id || null
		});
		return { ok: true };
	},

	update: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		const dateRaw = form.get('date')?.toString().trim();
		const description = form.get('description')?.toString().trim();
		const hours = form.get('hours')?.toString().trim();
		const userId = form.get('userId')?.toString().trim() || null;

		if (!id || !description || !hours) return fail(400, { error: 'Missing fields' });
		const date = dateRaw ? new Date(dateRaw) : new Date();
		if (isNaN(date.getTime())) return fail(400, { error: 'Invalid date' });

		await db
			.update(effortLog)
			.set({ date, description, hours, userId, updatedAt: new Date() })
			.where(eq(effortLog.id, id));
		return { ok: true };
	},

	delete: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(effortLog).where(eq(effortLog.id, id));
		return { ok: true };
	}
};
