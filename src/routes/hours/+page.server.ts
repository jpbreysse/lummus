import { db } from '$lib/server/db';
import { hoursEntry, workshop, user } from '$lib/server/db/schema';
import { asc, desc, eq, sql } from 'drizzle-orm';

export const load = async () => {
	const entries = await db
		.select({
			id: hoursEntry.id,
			kind: hoursEntry.kind,
			hours: hoursEntry.hours,
			notes: hoursEntry.notes,
			loggedOn: hoursEntry.loggedOn,
			memberName: user.name,
			workshopCode: workshop.code
		})
		.from(hoursEntry)
		.leftJoin(user, eq(hoursEntry.userId, user.id))
		.leftJoin(workshop, eq(hoursEntry.workshopId, workshop.id))
		.orderBy(desc(hoursEntry.loggedOn));

	const byMember = await db
		.select({
			memberName: user.name,
			total: sql<string>`coalesce(sum(${hoursEntry.hours}), 0)`
		})
		.from(hoursEntry)
		.innerJoin(user, eq(hoursEntry.userId, user.id))
		.groupBy(user.name)
		.orderBy(asc(user.name));

	const total = entries.reduce((s, e) => s + Number(e.hours), 0);

	return { entries, byMember, total };
};
