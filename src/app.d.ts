import type { auth } from '$lib/server/auth';

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
type AuthUser = NonNullable<AuthSession>['user'];

declare global {
	namespace App {
		interface Locals {
			session: NonNullable<AuthSession>['session'] | null;
			user: (AuthUser & { role: 'admin' | 'user' }) | null;
		}
	}
}

export {};
