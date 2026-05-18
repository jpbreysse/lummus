import { db } from '$lib/server/db';
import { workshop, question, workshopParticipant, hoursEntry } from '$lib/server/db/schema';
import { asc, inArray, sql } from 'drizzle-orm';
import { getAccessibleWorkshopIds } from '$lib/server/access';

export const load = async ({ locals }) => {
	const isAdmin = locals.user?.role === 'admin';
	const pubFilter = isAdmin ? sql`true` : sql`${question.published} = true`;
	const accessible = await getAccessibleWorkshopIds(locals.user);

	const rows = await db
		.select({
			id: workshop.id,
			code: workshop.code,
			title: workshop.title,
			description: workshop.description,
			weekNumber: workshop.weekNumber,
			sessionDurationMinutes: workshop.sessionDurationMinutes,
			scheduledAt: workshop.scheduledAt,
			status: workshop.status,
			total: sql<number>`(select count(*)::int from ${question} where ${question.workshopId} = ${workshop.id} and ${pubFilter})`,
			answered: sql<number>`(select count(*)::int from ${question} where ${question.workshopId} = ${workshop.id} and ${question.status} = 'answered' and ${pubFilter})`,
			participants: sql<number>`(select count(*)::int from ${workshopParticipant} where ${workshopParticipant.workshopId} = ${workshop.id})`,
			hours: sql<string>`coalesce((select sum(${hoursEntry.hours}) from ${hoursEntry} where ${hoursEntry.workshopId} = ${workshop.id}), 0)`
		})
		.from(workshop)
		.where(accessible ? inArray(workshop.id, [...accessible]) : undefined)
		.orderBy(asc(workshop.weekNumber));

	return { workshops: rows };
};
