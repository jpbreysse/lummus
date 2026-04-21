import { db } from '$lib/server/db';
import { teamMember, workshopParticipant, workshop } from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const members = await db
		.select({
			id: teamMember.id,
			name: teamMember.name,
			role: teamMember.role,
			organization: teamMember.organization,
			email: teamMember.email,
			workshops: sql<string[]>`coalesce(array_agg(${workshop.code} order by ${workshop.weekNumber}) filter (where ${workshop.code} is not null), '{}')`
		})
		.from(teamMember)
		.leftJoin(workshopParticipant, eq(workshopParticipant.teamMemberId, teamMember.id))
		.leftJoin(workshop, eq(workshop.id, workshopParticipant.workshopId))
		.groupBy(teamMember.id)
		.orderBy(asc(teamMember.id));

	return { members };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim();
		const role = form.get('role')?.toString().trim() || null;
		const organization = form.get('organization')?.toString().trim() || null;
		const email = form.get('email')?.toString().trim() || null;

		if (!name) return fail(400, { error: 'Name required' });
		await db.insert(teamMember).values({ name, role, organization, email });
		return { ok: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const name = form.get('name')?.toString().trim();
		const role = form.get('role')?.toString().trim() || null;
		const organization = form.get('organization')?.toString().trim() || null;
		const email = form.get('email')?.toString().trim() || null;

		if (!id || !name) return fail(400, { error: 'Missing fields' });
		await db
			.update(teamMember)
			.set({ name, role, organization, email })
			.where(eq(teamMember.id, id));
		return { ok: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(teamMember).where(eq(teamMember.id, id));
		return { ok: true };
	}
};
