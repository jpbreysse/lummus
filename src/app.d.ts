import type { auth } from '$lib/server/auth';

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

declare global {
	namespace App {
		interface Locals {
			session: NonNullable<AuthSession>['session'] | null;
			user: NonNullable<AuthSession>['user'] | null;
		}
	}
}

export {};
