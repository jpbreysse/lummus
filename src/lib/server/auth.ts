import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '$env/dynamic/private';
import { sql } from 'drizzle-orm';
import { db } from './db';
import * as schema from './db/schema';

const trustedOrigins = [
	'http://localhost:5173',
	'http://localhost:5174',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:5174'
];
if (env.BETTER_AUTH_URL) trustedOrigins.push(env.BETTER_AUTH_URL);

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	trustedOrigins,
	emailAndPassword: {
		enabled: true,
		autoSignIn: true
	},
	databaseHooks: {
		user: {
			create: {
				before: async (data) => {
					const [{ count }] = await db
						.select({ count: sql<number>`count(*)::int` })
						.from(schema.user);
					return {
						data: { ...data, role: count === 0 ? 'admin' : 'user' }
					};
				}
			}
		}
	}
});
