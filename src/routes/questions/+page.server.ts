import { db } from '$lib/server/db';
import { question, questionResponse, questionHistory, workshop } from '$lib/server/db/schema';
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

		const [before] = await db
			.select({ prompt: question.prompt, answer: question.answer, status: question.status })
			.from(question)
			.where(eq(question.id, id))
			.limit(1);

		await db.update(question).set({ prompt, answer, status }).where(eq(question.id, id));

		if (before) {
			const rows: { questionId: number; actorUserId: string | null; action: string; oldValue: string | null; newValue: string | null }[] = [];
			const actor = locals.user?.id ?? null;
			if (before.prompt !== prompt)
				rows.push({ questionId: id, actorUserId: actor, action: 'prompt', oldValue: before.prompt, newValue: prompt });
			if ((before.answer ?? '') !== (answer ?? ''))
				rows.push({ questionId: id, actorUserId: actor, action: 'answer', oldValue: before.answer, newValue: answer });
			if (before.status !== status)
				rows.push({ questionId: id, actorUserId: actor, action: 'status', oldValue: before.status, newValue: status });
			if (rows.length) await db.insert(questionHistory).values(rows);
		}
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

		const [created] = await db
			.insert(question)
			.values({ workshopId, prompt })
			.returning({ id: question.id });
		await db.insert(questionHistory).values({
			questionId: created.id,
			actorUserId: locals.user?.id ?? null,
			action: 'created',
			oldValue: null,
			newValue: prompt
		});
		return { ok: true };
	},

	setStatus: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = form.get('status')?.toString() as QuestionStatus;
		if (!id || !QUESTION_STATUSES.includes(status)) return fail(400, { error: 'Invalid' });

		const [before] = await db
			.select({ status: question.status })
			.from(question)
			.where(eq(question.id, id))
			.limit(1);

		await db.update(question).set({ status }).where(eq(question.id, id));

		if (before && before.status !== status) {
			await db.insert(questionHistory).values({
				questionId: id,
				actorUserId: locals.user?.id ?? null,
				action: 'status',
				oldValue: before.status,
				newValue: status
			});
		}
		return { ok: true };
	}
};
