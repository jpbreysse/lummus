import { db } from '$lib/server/db';
import { announcement, user } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: announcement.id,
			title: announcement.title,
			body: announcement.body,
			pinned: announcement.pinned,
			createdAt: announcement.createdAt,
			updatedAt: announcement.updatedAt,
			authorName: user.name
		})
		.from(announcement)
		.leftJoin(user, eq(user.id, announcement.authorUserId))
		.orderBy(desc(announcement.pinned), desc(announcement.createdAt));

	return { announcements: rows };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim();
		const body = form.get('body')?.toString().trim();
		const pinned = form.get('pinned') === 'on';

		if (!title || !body) return fail(400, { error: 'Title and body required' });

		await db.insert(announcement).values({
			title,
			body,
			pinned,
			authorUserId: locals.user?.id ?? null
		});
		return { ok: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const title = form.get('title')?.toString().trim();
		const body = form.get('body')?.toString().trim();
		const pinned = form.get('pinned') === 'on';

		if (!id || !title || !body) return fail(400, { error: 'Missing fields' });
		await db
			.update(announcement)
			.set({ title, body, pinned, updatedAt: new Date() })
			.where(eq(announcement.id, id));
		return { ok: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(announcement).where(eq(announcement.id, id));
		return { ok: true };
	}
};
