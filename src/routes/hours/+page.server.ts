import { db } from '$lib/server/db';
import { hoursEntry, workshop, teamMember } from '$lib/server/db/schema';
import { asc, desc, eq, sql } from 'drizzle-orm';

export const load = async () => {
	const entries = await db
		.select({
			id: hoursEntry.id,
			kind: hoursEntry.kind,
			hours: hoursEntry.hours,
			notes: hoursEntry.notes,
			loggedOn: hoursEntry.loggedOn,
			memberName: teamMember.name,
			workshopCode: workshop.code
		})
		.from(hoursEntry)
		.leftJoin(teamMember, eq(hoursEntry.teamMemberId, teamMember.id))
		.leftJoin(workshop, eq(hoursEntry.workshopId, workshop.id))
		.orderBy(desc(hoursEntry.loggedOn));

	const byMember = await db
		.select({
			memberName: teamMember.name,
			total: sql<string>`coalesce(sum(${hoursEntry.hours}), 0)`
		})
		.from(hoursEntry)
		.innerJoin(teamMember, eq(hoursEntry.teamMemberId, teamMember.id))
		.groupBy(teamMember.name)
		.orderBy(asc(teamMember.name));

	const total = entries.reduce((s, e) => s + Number(e.hours), 0);

	return { entries, byMember, total };
};
