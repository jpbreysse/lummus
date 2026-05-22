import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';

/**
 * Bearer-token guard for /api routes.
 *
 * Validates `Authorization: Bearer <token>` against the
 * `LUMMUS_API_TOKEN` server env var using a constant-time comparison.
 *
 * Throws:
 *   503 if the server has no token configured (fail-closed).
 *   401 if the header is missing, malformed, or the token is wrong.
 *
 * Rotation: change the env var on the host and redeploy (no DB,
 * no UI). To upgrade to per-integration tokens later, swap this
 * helper for a DB lookup — call sites stay the same.
 */
export function requireApiToken(request: Request): void {
	const expected = env.LUMMUS_API_TOKEN;
	if (!expected) {
		throw error(503, 'API token not configured on the server');
	}

	const header = request.headers.get('authorization') ?? '';
	const prefix = 'Bearer ';
	if (!header.startsWith(prefix)) {
		throw error(401, 'Missing Bearer token');
	}

	const provided = header.slice(prefix.length).trim();
	const a = Buffer.from(expected);
	const b = Buffer.from(provided);
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		throw error(401, 'Invalid API token');
	}
}
