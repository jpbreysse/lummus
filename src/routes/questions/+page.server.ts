import { db } from '$lib/server/db';
import { question, workshop } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const QUESTION_STATUSES = ['open', 'answered', 'deferred'] as const;
type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: question.id,
			prompt: question.prompt,
			answer: question.answer,
			status: question.status,
			workshopCode: workshop.code,
			workshopTitle: workshop.title,
			weekNumber: workshop.weekNumber
		})
		.from(question)
		.innerJoin(workshop, eq(question.workshopId, workshop.id))
		.orderBy(asc(workshop.weekNumber), asc(question.id));

	return { questions: rows };
};

export const actions: Actions = {
	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const prompt = form.get('prompt')?.toString().trim();
		const answer = form.get('answer')?.toString().trim() || null;
		const status = form.get('status')?.toString() as QuestionStatus;

		if (!id || !prompt) return fail(400, { error: 'Missing fields' });
		if (!QUESTION_STATUSES.includes(status)) return fail(400, { error: 'Invalid status' });

		await db.update(question).set({ prompt, answer, status }).where(eq(question.id, id));
		return { ok: true };
	},

	setStatus: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = form.get('status')?.toString() as QuestionStatus;
		if (!id || !QUESTION_STATUSES.includes(status)) return fail(400, { error: 'Invalid' });
		await db.update(question).set({ status }).where(eq(question.id, id));
		return { ok: true };
	}
};
