import { db } from '$lib/server/db';
import {
	workshop,
	question,
	questionComment,
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

export const load: PageServerLoad = async ({ params }) => {
	const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
	if (!ws) throw error(404, `Workshop ${params.code} not found`);

	const questions = await db
		.select()
		.from(question)
		.where(eq(question.workshopId, ws.id))
		.orderBy(asc(question.id));

	const questionIds = questions.map((q) => q.id);
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
				.where(inArray(questionComment.questionId, questionIds))
				.orderBy(asc(questionComment.createdAt))
		: [];

	const commentsByQuestion = new Map<number, typeof commentsRaw>();
	for (const c of commentsRaw) {
		const list = commentsByQuestion.get(c.questionId) ?? [];
		list.push(c);
		commentsByQuestion.set(c.questionId, list);
	}
	const questionsWithComments = questions.map((q) => ({
		...q,
		comments: commentsByQuestion.get(q.id) ?? []
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
		allMembers
	};
};

export const actions: Actions = {
	updateWorkshop: async ({ request, params }) => {
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

	updateQuestion: async ({ request }) => {
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

	addQuestion: async ({ request, params }) => {
		const form = await request.formData();
		const prompt = form.get('prompt')?.toString().trim();
		if (!prompt) return fail(400, { error: 'Prompt required' });

		const [ws] = await db.select().from(workshop).where(eq(workshop.code, params.code)).limit(1);
		if (!ws) return fail(404, { error: 'Workshop not found' });

		await db.insert(question).values({ workshopId: ws.id, prompt });
		return { ok: true };
	},

	deleteQuestion: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(question).where(eq(question.id, id));
		return { ok: true };
	},

	addHours: async ({ request, params }) => {
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

	deleteHours: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing id' });
		await db.delete(hoursEntry).where(eq(hoursEntry.id, id));
		return { ok: true };
	},

	addParticipant: async ({ request, params }) => {
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
		if (c.authorUserId && c.authorUserId !== locals.user?.id) {
			return fail(403, { error: 'Only the author can delete' });
		}
		await db.delete(questionComment).where(eq(questionComment.id, id));
		return { ok: true };
	},

	removeParticipant: async ({ request, params }) => {
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
