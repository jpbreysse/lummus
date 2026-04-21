import { db } from '$lib/server/db';
import { invite } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { error, fail, redirect, isRedirect, type Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type CookieOptions = Parameters<Cookies['set']>[2];

async function loadInvite(code: string) {
	const [row] = await db
		.select()
		.from(invite)
		.where(
			and(
				eq(invite.code, code),
				isNull(invite.usedAt),
				or(isNull(invite.expiresAt), gt(invite.expiresAt, sql`now()`))
			)
		)
		.limit(1);
	return row ?? null;
}

function applySetCookieHeaders(headers: Headers, cookies: Cookies) {
	for (const str of headers.getSetCookie()) {
		const [first, ...rest] = str.split(';');
		const eq = first.indexOf('=');
		if (eq < 0) continue;
		const cookieName = first.slice(0, eq).trim();
		const cookieValue = decodeURIComponent(first.slice(eq + 1).trim());

		const opts: CookieOptions = { path: '/' };
		for (const part of rest) {
			const [k, v] = part.trim().split('=');
			const key = k.toLowerCase();
			if (key === 'max-age') opts.maxAge = parseInt(v, 10);
			else if (key === 'path') opts.path = v;
			else if (key === 'domain') opts.domain = v;
			else if (key === 'expires') opts.expires = new Date(v);
			else if (key === 'httponly') opts.httpOnly = true;
			else if (key === 'secure') opts.secure = true;
			else if (key === 'samesite')
				opts.sameSite = v.toLowerCase() as 'lax' | 'strict' | 'none';
		}
		cookies.set(cookieName, cookieValue, opts);
	}
}

export const load: PageServerLoad = async ({ url }) => {
	const code = url.searchParams.get('invite');
	if (!code) throw error(403, 'Signup is invite-only. Ask an admin for an invite link.');

	const row = await loadInvite(code);
	if (!row) throw error(403, 'This invite link is invalid, expired, or already used.');

	return { inviteCode: row.code, inviteEmail: row.email };
};

export const actions: Actions = {
	default: async ({ request, url, cookies }) => {
		const form = await request.formData();
		const code = form.get('inviteCode')?.toString() ?? url.searchParams.get('invite') ?? '';
		const name = form.get('name')?.toString().trim() ?? '';
		const email = form.get('email')?.toString().trim().toLowerCase() ?? '';
		const password = form.get('password')?.toString() ?? '';

		if (!name || !email || !password) return fail(400, { error: 'All fields are required' });
		if (password.length < 8) return fail(400, { error: 'Password must be at least 8 characters' });

		const row = await loadInvite(code);
		if (!row) return fail(403, { error: 'Invite link is invalid, expired, or already used' });
		if (row.email && row.email.toLowerCase() !== email) {
			return fail(400, { error: 'This invite is for a different email address' });
		}

		try {
			const { response, headers } = await auth.api.signUpEmail({
				body: { name, email, password },
				headers: request.headers,
				returnHeaders: true
			});

			applySetCookieHeaders(headers, cookies);

			await db
				.update(invite)
				.set({ usedAt: new Date(), usedByUserId: response.user.id })
				.where(eq(invite.id, row.id));
		} catch (e) {
			if (isRedirect(e)) throw e;
			const message = e instanceof Error ? e.message : 'Signup failed';
			return fail(400, { error: message });
		}

		throw redirect(303, '/');
	}
};
