import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';

const PUBLIC_PATHS = ['/login', '/signup'];

const blockPublicSignUp: Handle = async ({ event, resolve }) => {
	if (
		event.url.pathname === '/api/auth/sign-up/email' &&
		event.request.method === 'POST'
	) {
		return json(
			{ message: 'Signup is invite-only. Use /signup with a valid invite link.' },
			{ status: 403 }
		);
	}
	return resolve(event);
};

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

const guard: Handle = async ({ event, resolve }) => {
	const isPublic =
		PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p)) ||
		event.url.pathname.startsWith('/api/auth');

	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	if (!session && !isPublic) {
		const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(302, `/login?redirectTo=${redirectTo}`);
	}

	if (session && (event.url.pathname === '/login' || event.url.pathname === '/signup')) {
		throw redirect(302, '/');
	}

	return resolve(event);
};

export const handle = sequence(blockPublicSignUp, authHandler, guard);
