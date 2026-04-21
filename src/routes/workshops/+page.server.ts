import { db } from '$lib/server/db';
import { workshop, question, workshopParticipant, hoursEntry } from '$lib/server/db/schema';
import { asc, sql } from 'drizzle-orm';

export const load = async () => {
	const rows = await db
		.select({
			id: workshop.id,
			code: workshop.code,
			title: workshop.title,
			description: workshop.description,
			weekNumber: workshop.weekNumber,
			sessionDurationMinutes: workshop.sessionDurationMinutes,
			status: workshop.status,
			total: sql<number>`(select count(*)::int from ${question} where ${question.workshopId} = ${workshop.id})`,
			answered: sql<number>`(select count(*)::int from ${question} where ${question.workshopId} = ${workshop.id} and ${question.status} = 'answered')`,
			participants: sql<number>`(select count(*)::int from ${workshopParticipant} where ${workshopParticipant.workshopId} = ${workshop.id})`,
			hours: sql<string>`coalesce((select sum(${hoursEntry.hours}) from ${hoursEntry} where ${hoursEntry.workshopId} = ${workshop.id}), 0)`
		})
		.from(workshop)
		.orderBy(asc(workshop.weekNumber));

	return { workshops: rows };
};
