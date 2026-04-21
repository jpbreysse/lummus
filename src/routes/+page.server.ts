import { db } from '$lib/server/db';
import {
	workshop,
	question,
	hoursEntry,
	teamMember,
	workshopParticipant,
	announcement,
	user
} from '$lib/server/db/schema';
import { and, asc, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';

export const load = async () => {
	const statusCounts = await db
		.select({
			status: workshop.status,
			count: sql<number>`count(*)::int`
		})
		.from(workshop)
		.groupBy(workshop.status);

	const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.count])) as Record<
		string,
		number
	>;

	const [{ totalHours, memberCount, workshopCount }] = await db
		.select({
			totalHours: sql<string>`coalesce(sum(${hoursEntry.hours}), 0)`,
			memberCount: sql<number>`(select count(*)::int from ${teamMember})`,
			workshopCount: sql<number>`(select count(*)::int from ${workshop})`
		})
		.from(hoursEntry);

	const [{ totalQuestions, answered }] = await db
		.select({
			totalQuestions: sql<number>`count(*)::int`,
			answered: sql<number>`sum(case when ${question.status} = 'answered' then 1 else 0 end)::int`
		})
		.from(question);

	const workshopProgress = await db
		.select({
			id: workshop.id,
			code: workshop.code,
			title: workshop.title,
			status: workshop.status,
			weekNumber: workshop.weekNumber,
			scheduledAt: workshop.scheduledAt,
			total: sql<number>`(select count(*)::int from ${question} where ${question.workshopId} = ${workshop.id})`,
			answered: sql<number>`(select count(*)::int from ${question} where ${question.workshopId} = ${workshop.id} and ${question.status} = 'answered')`,
			participants: sql<number>`(select count(*)::int from ${workshopParticipant} where ${workshopParticipant.workshopId} = ${workshop.id})`,
			hours: sql<string>`coalesce((select sum(${hoursEntry.hours}) from ${hoursEntry} where ${hoursEntry.workshopId} = ${workshop.id}), 0)`
		})
		.from(workshop)
		.orderBy(asc(workshop.weekNumber));

	const [nextWorkshop] = await db
		.select({
			id: workshop.id,
			code: workshop.code,
			title: workshop.title,
			scheduledAt: workshop.scheduledAt,
			sessionDurationMinutes: workshop.sessionDurationMinutes
		})
		.from(workshop)
		.where(and(isNotNull(workshop.scheduledAt), gt(workshop.scheduledAt, sql`now()`)))
		.orderBy(asc(workshop.scheduledAt))
		.limit(1);

	const recentAnnouncements = await db
		.select({
			id: announcement.id,
			title: announcement.title,
			body: announcement.body,
			pinned: announcement.pinned,
			createdAt: announcement.createdAt,
			authorName: user.name
		})
		.from(announcement)
		.leftJoin(user, eq(user.id, announcement.authorUserId))
		.orderBy(desc(announcement.pinned), desc(announcement.createdAt))
		.limit(3);

	return {
		summary: {
			workshopCount,
			memberCount,
			totalHours: Number(totalHours),
			totalQuestions,
			answered,
			byStatus
		},
		workshopProgress,
		nextWorkshop: nextWorkshop ?? null,
		recentAnnouncements
	};
};
