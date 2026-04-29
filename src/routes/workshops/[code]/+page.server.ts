import { db } from '$lib/server/db';
import {
	workshop,
	question,
	questionComment,
	questionResponse,
	questionHistory,
	workshopParticipant,
	teamMember,
	hoursEntry,
	user
} from '$lib/server/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const WORKSHOP_STATUSES = ['upcoming', 'in_progress', 'completed', 'cancelled'] as const;
const QUESTION_STATUSES = ['open', 'answered', 'deferred'] as const;
type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];
type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const load: PageServerLoad = async ({ params, locals }) => {
	const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
	if (!ws) throw error(404, `Workshop ${params.code} not found`);

	const isAdmin = locals.user?.role === 'admin';
	const userId = locals.user?.id ?? null;

	const rawQuestions = await db
		.select()
		.from(question)
		.where(
			isAdmin
				? eq(question.workshopId, ws.id)
				: and(eq(question.workshopId, ws.id), eq(question.published, true))
		)
		.orderBy(asc(question.id));

	// Non-admins never see the consolidated answer
	const questions = rawQuestions.map((q) => ({
		...q,
		answer: isAdmin ? q.answer : null
	}));

	const questionIds = questions.map((q) => q.id);

	// Comments — admins see all, standard users see only their own
	const commentsRaw = questionIds.length
		? await db
				.select({
					id: questionComment.id,
					questionId: questionComment.questionId,
					body: questionComment.body,
					createdAt: questionComment.createdAt,
					authorUserId: questionComment.authorUserId,
					authorName: user.name
				})
				.from(questionComment)
				.leftJoin(user, eq(user.id, questionComment.authorUserId))
				.where(
					isAdmin
						? inArray(questionComment.questionId, questionIds)
						: and(
								inArray(questionComment.questionId, questionIds),
								userId ? eq(questionComment.authorUserId, userId) : eq(questionComment.id, -1)
							)
				)
				.orderBy(asc(questionComment.createdAt))
		: [];

	// History — admin only (audit log of question changes)
	const historyRaw = isAdmin && questionIds.length
		? await db
				.select({
					id: questionHistory.id,
					questionId: questionHistory.questionId,
					action: questionHistory.action,
					oldValue: questionHistory.oldValue,
					newValue: questionHistory.newValue,
					createdAt: questionHistory.createdAt,
					actorName: user.name
				})
				.from(questionHistory)
				.leftJoin(user, eq(user.id, questionHistory.actorUserId))
				.where(inArray(questionHistory.questionId, questionIds))
				.orderBy(asc(questionHistory.createdAt))
		: [];

	// Responses — admins see all, standard users only their own
	const responsesRaw = questionIds.length
		? await db
				.select({
					id: questionResponse.id,
					questionId: questionResponse.questionId,
					body: questionResponse.body,
					createdAt: questionResponse.createdAt,
					updatedAt: questionResponse.updatedAt,
					userId: questionResponse.userId,
					userName: user.name
				})
				.from(questionResponse)
				.leftJoin(user, eq(user.id, questionResponse.userId))
				.where(
					isAdmin
						? inArray(questionResponse.questionId, questionIds)
						: and(
								inArray(questionResponse.questionId, questionIds),
								userId ? eq(questionResponse.userId, userId) : eq(questionResponse.id, -1)
							)
				)
				.orderBy(asc(questionResponse.createdAt))
		: [];

	const commentsByQuestion = new Map<number, typeof commentsRaw>();
	for (const c of commentsRaw) {
		const list = commentsByQuestion.get(c.questionId) ?? [];
		list.push(c);
		commentsByQuestion.set(c.questionId, list);
	}

	const responsesByQuestion = new Map<number, typeof responsesRaw>();
	for (const r of responsesRaw) {
		const list = responsesByQuestion.get(r.questionId) ?? [];
		list.push(r);
		responsesByQuestion.set(r.questionId, list);
	}

	const historyByQuestion = new Map<number, typeof historyRaw>();
	for (const h of historyRaw) {
		const list = historyByQuestion.get(h.questionId) ?? [];
		list.push(h);
		historyByQuestion.set(h.questionId, list);
	}

	const questionsWithComments = questions.map((q) => ({
		...q,
		comments: commentsByQuestion.get(q.id) ?? [],
		responses: responsesByQuestion.get(q.id) ?? [],
		history: historyByQuestion.get(q.id) ?? []
	}));

	const participants = await db
		.select({
			id: teamMember.id,
			name: teamMember.name,
			role: teamMember.role,
			organization: teamMember.organization
		})
		.from(workshopParticipant)
		.innerJoin(teamMember, eq(workshopParticipant.teamMemberId, teamMember.id))
		.where(eq(workshopParticipant.workshopId, ws.id));

	const hours = await db
		.select({
			id: hoursEntry.id,
			kind: hoursEntry.kind,
			hours: hoursEntry.hours,
			memberName: teamMember.name,
			teamMemberId: hoursEntry.teamMemberId
		})
		.from(hoursEntry)
		.leftJoin(teamMember, eq(hoursEntry.teamMemberId, teamMember.id))
		.where(eq(hoursEntry.workshopId, ws.id));

	const allMembers = await db
		.select({ id: teamMember.id, name: teamMember.name, role: teamMember.role })
		.from(teamMember)
		.orderBy(asc(teamMember.name));

	return {
		workshop: ws,
		questions: questionsWithComments,
		participants,
		hours,
		allMembers,
		isAdmin
	};
};

const requireAdmin = (locals: App.Locals) => locals.user?.role === 'admin';

export const actions: Actions = {
	updateWorkshop: async ({ request, params, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const title = form.get('title')?.toString().trim();
		const description = form.get('description')?.toString().trim() || null;
		const status = form.get('status')?.toString() as WorkshopStatus;
		const weekNumber = form.get('weekNumber')?.toString();
		const scheduledAtRaw = form.get('scheduledAt')?.toString().trim();

		if (!title) return fail(400, { error: 'Title required' });
		if (!WORKSHOP_STATUSES.includes(status)) return fail(400, { error: 'Invalid status' });

		const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
		if (scheduledAt && isNaN(scheduledAt.getTime())) {
			return fail(400, { error: 'Invalid date' });
		}

		await db
			.update(workshop)
			.set({
				title,
				description,
				status,
				weekNumber: weekNumber ? Number(weekNumber) : null,
				scheduledAt,
				updatedAt: new Date()
			})
			.where(eq(workshop.code, params.code));

		return { ok: true };
	},

	updateQuestion: async ({ request, locals }) => {
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
			if (before.prompt !== prompt) {
				rows.push({ questionId: id, actorUserId: actor, action: 'prompt', oldValue: before.prompt, newValue: prompt });
			}
			if ((before.answer ?? '') !== (answer ?? '')) {
				rows.push({ questionId: id, actorUserId: actor, action: 'answer', oldValue: before.answer, newValue: answer });
			}
			if (before.status !== status) {
				rows.push({ questionId: id, actorUserId: actor, action: 'status', oldValue: before.status, newValue: status });
			}
			if (rows.length) await db.insert(questionHistory).values(rows);
		}

		return { ok: true };
	},

	addQuestion: async ({ request, params, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const prompt = form.get('prompt')?.toString().trim();
		if (!prompt) return fail(400, { error: 'Prompt required' });

		const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		const [created] = await db
			.insert(question)
			.values({ workshopId: ws.id, prompt })
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

	setPublished: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		const published = form.get('published') === 'true';
		if (!id) return fail(400, { error: 'Missing id' });

		const [before] = await db
			.select({ published: question.published })
			.from(question)
			.where(eq(question.id, id))
			.limit(1);
		if (!before) return fail(404, { error: 'Not found' });

		await db.update(question).set({ published }).where(eq(question.id, id));

		if (before.published !== published) {
			await db.insert(questionHistory).values({
				questionId: id,
				actorUserId: locals.user?.id ?? null,
				action: 'published',
				oldValue: before.published ? 'published' : 'draft',
				newValue: published ? 'published' : 'draft'
			});
		}
		return { ok: true };
	},

	publishAll: async ({ request, params, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });

		const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		const drafts = await db
			.select({ id: question.id })
			.from(question)
			.where(and(eq(question.workshopId, ws.id), eq(question.published, false)));

		if (!drafts.length) return { ok: true, count: 0 };

		await db
			.update(question)
			.set({ published: true })
			.where(and(eq(question.workshopId, ws.id), eq(question.published, false)));

		const actor = locals.user?.id ?? null;
		await db.insert(questionHistory).values(
			drafts.map((d) => ({
				questionId: d.id,
				actorUserId: actor,
				action: 'published',
				oldValue: 'draft',
				newValue: 'published'
			}))
		);

		return { ok: true, count: drafts.length };
	},

	deleteQuestion: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		// Note: history rows cascade-delete with the question, so we don't log a 'deleted'
		// event (it would be immediately purged). If you need a tombstone, store history
		// without the FK or move it to a separate audit table.
		await db.delete(question).where(eq(question.id, id));
		return { ok: true };
	},

	addHours: async ({ request, params, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const teamMemberId = Number(form.get('teamMemberId'));
		const hours = form.get('hours')?.toString().trim();
		const kind = form.get('kind')?.toString().trim();

		if (!teamMemberId || !hours || !kind) return fail(400, { error: 'Missing fields' });

		const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		await db.insert(hoursEntry).values({ workshopId: ws.id, teamMemberId, kind, hours });
		return { ok: true };
	},

	deleteHours: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(hoursEntry).where(eq(hoursEntry.id, id));
		return { ok: true };
	},

	addParticipant: async ({ request, params, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const teamMemberId = Number(form.get('teamMemberId'));
		if (!teamMemberId) return fail(400, { error: 'Missing member' });

		const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		await db
			.insert(workshopParticipant)
			.values({ workshopId: ws.id, teamMemberId })
			.onConflictDoNothing();
		return { ok: true };
	},

	addComment: async ({ request, locals }) => {
		const form = await request.formData();
		const questionId = Number(form.get('questionId'));
		const body = form.get('body')?.toString().trim();
		if (!questionId || !body) return fail(400, { error: 'Missing fields' });

		await db.insert(questionComment).values({
			questionId,
			body,
			authorUserId: locals.user?.id ?? null
		});
		return { ok: true };
	},

	saveResponse: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not signed in' });
		const form = await request.formData();
		const questionId = Number(form.get('questionId'));
		const body = form.get('body')?.toString().trim();
		if (!questionId || !body) return fail(400, { error: 'Missing fields' });

		const [existing] = await db
			.select({ id: questionResponse.id })
			.from(questionResponse)
			.where(
				and(
					eq(questionResponse.questionId, questionId),
					eq(questionResponse.userId, locals.user.id)
				)
			)
			.limit(1);

		if (existing) {
			await db
				.update(questionResponse)
				.set({ body, updatedAt: new Date() })
				.where(eq(questionResponse.id, existing.id));
		} else {
			await db
				.insert(questionResponse)
				.values({ questionId, userId: locals.user.id, body });
		}
		return { ok: true };
	},

	deleteResponse: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not signed in' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });

		const [row] = await db
			.select({ userId: questionResponse.userId })
			.from(questionResponse)
			.where(eq(questionResponse.id, id))
			.limit(1);
		if (!row) return fail(404, { error: 'Not found' });

		const isAdmin = locals.user.role === 'admin';
		if (row.userId !== locals.user.id && !isAdmin) {
			return fail(403, { error: 'Not allowed' });
		}
		await db.delete(questionResponse).where(eq(questionResponse.id, id));
		return { ok: true };
	},

	deleteComment: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });

		const [c] = await db
			.select({ authorUserId: questionComment.authorUserId })
			.from(questionComment)
			.where(eq(questionComment.id, id))
			.limit(1);
		if (!c) return fail(404, { error: 'Not found' });
		const isAdmin = locals.user?.role === 'admin';
		if (c.authorUserId && c.authorUserId !== locals.user?.id && !isAdmin) {
			return fail(403, { error: 'Only the author or an admin can delete' });
		}
		await db.delete(questionComment).where(eq(questionComment.id, id));
		return { ok: true };
	},

	removeParticipant: async ({ request, params, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const teamMemberId = Number(form.get('teamMemberId'));
		if (!teamMemberId) return fail(400, { error: 'Missing member' });

		const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		await db
			.delete(workshopParticipant)
			.where(
				and(
					eq(workshopParticipant.workshopId, ws.id),
					eq(workshopParticipant.teamMemberId, teamMemberId)
				)
			);
		return { ok: true };
	}
};
