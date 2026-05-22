import { json, type RequestHandler } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invite, workshop } from '$lib/server/db/schema';
import { parseWorkshopRole } from '$lib/workshop-roles';
import { requireApiToken } from '$lib/server/api-auth';

/**
 * POST /api/invites — create an invite programmatically.
 *
 * Auth: Bearer LUMMUS_API_TOKEN (single shared secret, server env).
 *
 * Request body (all fields optional):
 *   {
 *     email?:          string,     // scope the invite to one address
 *     ttlDays?:        number,     // default 7, must be > 0
 *     workshopRole?:   "PM" | "Engineer" | "IT",
 *     workshopCodes?:  string[]    // e.g. ["W1", "W2"]
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     code, inviteUrl, expiresAt,
 *     email, workshopRole, workshopCodes
 *   }
 *
 * Errors:
 *   400 invalid JSON / bad ttl / unknown workshop code
 *   401 missing or bad bearer token
 *   503 server has no LUMMUS_API_TOKEN configured
 */
export const POST: RequestHandler = async ({ request, url }) => {
	requireApiToken(request);

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return json({ error: 'Body must be valid JSON' }, { status: 400 });
	}
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return json({ error: 'Body must be a JSON object' }, { status: 400 });
	}
	const body = raw as Record<string, unknown>;

	const email =
		typeof body.email === 'string' && body.email.trim()
			? body.email.trim().toLowerCase()
			: null;

	const ttlDays =
		typeof body.ttlDays === 'number' && Number.isFinite(body.ttlDays) && body.ttlDays > 0
			? Math.floor(body.ttlDays)
			: 7;
	if (ttlDays > 365) {
		return json({ error: 'ttlDays must be ≤ 365' }, { status: 400 });
	}

	const workshopRole = parseWorkshopRole(body.workshopRole);

	const codesRequested = Array.isArray(body.workshopCodes)
		? body.workshopCodes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
		: [];

	let workshopCodes: string[] | null = null;
	if (codesRequested.length) {
		const existing = await db
			.select({ code: workshop.code })
			.from(workshop)
			.where(inArray(workshop.code, codesRequested));
		const valid = new Set(existing.map((e) => e.code));
		const unknown = codesRequested.filter((c) => !valid.has(c));
		if (unknown.length) {
			return json(
				{ error: `Unknown workshop code(s): ${unknown.join(', ')}` },
				{ status: 400 }
			);
		}
		workshopCodes = codesRequested;
	}

	const code = randomBytes(18).toString('base64url');
	const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

	await db.insert(invite).values({
		code,
		email,
		workshopRole,
		workshopCodes,
		// createdByUserId is null for API-created invites — there's no
		// authenticated user behind a bearer-token call.
		createdByUserId: null,
		expiresAt
	});

	return json({
		ok: true,
		code,
		inviteUrl: `${url.origin}/signup?invite=${code}`,
		expiresAt: expiresAt.toISOString(),
		email,
		workshopRole,
		workshopCodes
	});
};
