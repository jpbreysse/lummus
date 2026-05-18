import { db } from '$lib/server/db';
import { user, workshopParticipant, workshop } from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

const requireAdmin = (locals: App.Locals) => locals.user?.role === 'admin';

function syntheticEmail() {
	return `stakeholder-${randomBytes(6).toString('hex')}@lummus.local`;
}

export const load: PageServerLoad = async () => {
	const members = await db
		.select({
			id: user.id,
			name: user.name,
			workshopRole: user.workshopRole,
			organization: user.organization,
			email: user.email,
			role: user.role,
			workshops: sql<string[]>`coalesce(array_agg(${workshop.code} order by ${workshop.weekNumber}) filter (where ${workshop.code} is not null), '{}')`
		})
		.from(user)
		.leftJoin(workshopParticipant, eq(workshopParticipant.userId, user.id))
		.leftJoin(workshop, eq(workshop.id, workshopParticipant.workshopId))
		.groupBy(user.id)
		.orderBy(asc(user.name));

	return { members };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const name = form.get('name')?.toString().trim();
		const workshopRole = form.get('role')?.toString().trim() || null;
		const organization = form.get('organization')?.toString().trim() || null;
		const emailInput = form.get('email')?.toString().trim().toLowerCase() || null;

		if (!name) return fail(400, { error: 'Name required' });

		await db.insert(user).values({
			id: 'stake_' + randomBytes(8).toString('hex'),
			name,
			email: emailInput ?? syntheticEmail(),
			workshopRole,
			organization,
			role: 'user'
		});
		return { ok: true };
	},

	update: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = form.get('id')?.toString();
		const name = form.get('name')?.toString().trim();
		const workshopRole = form.get('role')?.toString().trim() || null;
		const organization = form.get('organization')?.toString().trim() || null;
		const email = form.get('email')?.toString().trim().toLowerCase() || null;

		if (!id || !name) return fail(400, { error: 'Missing fields' });

		const patch: {
			name: string;
			workshopRole: string | null;
			organization: string | null;
			email?: string;
		} = { name, workshopRole, organization };
		if (email) patch.email = email;

		await db.update(user).set(patch).where(eq(user.id, id));
		return { ok: true };
	},

	delete: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = form.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing id' });
		if (locals.user && id === locals.user.id) {
			return fail(400, { error: 'Cannot delete your own account here' });
		}
		await db.delete(user).where(eq(user.id, id));
		return { ok: true };
	}
};
