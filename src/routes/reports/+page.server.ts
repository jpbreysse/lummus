import { db } from '$lib/server/db';
import {
	workshop,
	question,
	questionResponse,
	questionComment,
	questionAnonymousResponse,
	user
} from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') throw error(403, 'Admins only');

	const workshops = await db
		.select({ id: workshop.id, code: workshop.code, title: workshop.title })
		.from(workshop)
		.orderBy(asc(workshop.weekNumber));

	const users = await db
		.select({ id: user.id, name: user.name, email: user.email, role: user.role })
		.from(user)
		.orderBy(asc(user.name));

	// Named responses count per (user, workshop)
	const responseCounts = await db
		.select({
			userId: questionResponse.userId,
			workshopId: question.workshopId,
			n: sql<number>`count(*)::int`
		})
		.from(questionResponse)
		.innerJoin(question, eq(question.id, questionResponse.questionId))
		.groupBy(questionResponse.userId, question.workshopId);

	// Comments count per (user, workshop)
	const commentCounts = await db
		.select({
			userId: questionComment.authorUserId,
			workshopId: question.workshopId,
			n: sql<number>`count(*)::int`
		})
		.from(questionComment)
		.innerJoin(question, eq(question.id, questionComment.questionId))
		.groupBy(questionComment.authorUserId, question.workshopId);

	// Anonymous responses per workshop (no user attribution)
	const anonCounts = await db
		.select({
			workshopId: question.workshopId,
			n: sql<number>`count(*)::int`
		})
		.from(questionAnonymousResponse)
		.innerJoin(question, eq(question.id, questionAnonymousResponse.questionId))
		.groupBy(question.workshopId);

	// Question count per workshop (denominator for response rate)
	const questionCounts = await db
		.select({
			workshopId: question.workshopId,
			n: sql<number>`count(*)::int`
		})
		.from(question)
		.where(eq(question.published, true))
		.groupBy(question.workshopId);

	// Build lookup maps
	const key = (u: string, w: number) => `${u}::${w}`;
	const responsesByKey = new Map<string, number>();
	for (const r of responseCounts) responsesByKey.set(key(r.userId, r.workshopId), r.n);
	const commentsByKey = new Map<string, number>();
	for (const c of commentCounts) {
		if (c.userId) commentsByKey.set(key(c.userId, c.workshopId), c.n);
	}
	const anonByWs = new Map<number, number>();
	for (const a of anonCounts) anonByWs.set(a.workshopId, a.n);
	const questionsByWs = new Map<number, number>();
	for (const q of questionCounts) questionsByWs.set(q.workshopId, q.n);

	// Build matrix
	const matrix = users.map((u) => {
		const cells = workshops.map((w) => ({
			workshopId: w.id,
			responses: responsesByKey.get(key(u.id, w.id)) ?? 0,
			comments: commentsByKey.get(key(u.id, w.id)) ?? 0
		}));
		const totalResponses = cells.reduce((s, c) => s + c.responses, 0);
		const totalComments = cells.reduce((s, c) => s + c.comments, 0);
		return { user: u, cells, totalResponses, totalComments };
	});

	const anonRow = workshops.map((w) => ({
		workshopId: w.id,
		count: anonByWs.get(w.id) ?? 0
	}));
	const anonTotal = anonRow.reduce((s, c) => s + c.count, 0);

	const totalsRow = workshops.map((w) => {
		const responses = matrix.reduce(
			(s, m) => s + (m.cells.find((c) => c.workshopId === w.id)?.responses ?? 0),
			0
		);
		const comments = matrix.reduce(
			(s, m) => s + (m.cells.find((c) => c.workshopId === w.id)?.comments ?? 0),
			0
		);
		return {
			workshopId: w.id,
			responses,
			comments,
			anonymous: anonByWs.get(w.id) ?? 0,
			questions: questionsByWs.get(w.id) ?? 0
		};
	});

	return { workshops, matrix, anonRow, anonTotal, totalsRow };
};
