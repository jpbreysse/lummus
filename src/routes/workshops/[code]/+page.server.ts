import { db } from '$lib/server/db';
import {
	workshop,
	question,
	questionComment,
	questionResponse,
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
		.where(eq(question.workshopId, ws.id))
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

	const questionsWithComments = questions.map((q) => ({
		...q,
		comments: commentsByQuestion.get(q.id) ?? [],
		responses: responsesByQuestion.get(q.id) ?? []
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

		await db.update(question).set({ prompt, answer, status }).where(eq(question.id, id));
		return { ok: true };
	},

	addQuestion: async ({ request, params, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const prompt = form.get('prompt')?.toString().trim();
		if (!prompt) return fail(400, { error: 'Prompt required' });

		const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		await db.insert(question).values({ workshopId: ws.id, prompt });
		return { ok: true };
	},

	deleteQuestion: async ({ request, locals }) => {
		if (!requireAdmin(locals)) return fail(403, { error: 'Admin only' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
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
