import { db } from '$lib/server/db';
import { question, questionResponse, workshop } from '$lib/server/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const QUESTION_STATUSES = ['open', 'answered', 'deferred'] as const;
type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const load: PageServerLoad = async ({ locals }) => {
	const isAdmin = locals.user?.role === 'admin';
	const userId = locals.user?.id ?? null;

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

	// Own responses per question (for standard users to see their own answer summary)
	const ownResponses = userId
		? await db
				.select({ questionId: questionResponse.questionId, body: questionResponse.body })
				.from(questionResponse)
				.where(eq(questionResponse.userId, userId))
		: [];
	const ownByQ = new Map(ownResponses.map((r) => [r.questionId, r.body]));

	const questions = rows.map((r) => ({
		...r,
		answer: isAdmin ? r.answer : null,
		ownResponse: ownByQ.get(r.id) ?? null
	}));

	const workshops = await db
		.select({ id: workshop.id, code: workshop.code, title: workshop.title })
		.from(workshop)
		.orderBy(asc(workshop.weekNumber));

	return { questions, isAdmin, workshops };
};

const requireAdmin = (locals: App.Locals) => locals.user?.role === 'admin';

export const actions: Actions = {
	update: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
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

	create: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const workshopId = Number(form.get('workshopId'));
		const prompt = form.get('prompt')?.toString().trim();
		if (!workshopId || !prompt) return fail(400, { error: 'Missing fields' });

		const [ws] = await db
			.select({ id: workshop.id })
			.from(workshop)
			.where(eq(workshop.id, workshopId))
			.limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		await db.insert(question).values({ workshopId, prompt });
		return { ok: true };
	},

	setStatus: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = form.get('status')?.toString() as QuestionStatus;
		if (!id || !QUESTION_STATUSES.includes(status)) return fail(400, { error: 'Invalid' });
		await db.update(question).set({ status }).where(eq(question.id, id));
		return { ok: true };
	}
};
