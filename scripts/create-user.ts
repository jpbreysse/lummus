import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set');

const client = postgres(url);
const db = drizzle(client);

const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET ?? 'bootstrap-only',
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	emailAndPassword: { enabled: true }
});

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
	console.error('Usage: tsx scripts/create-user.ts "Name" email password');
	process.exit(1);
}

const result = await auth.api.signUpEmail({
	body: { name, email, password },
	headers: new Headers()
});

console.log('✓ Created user:', { id: result.user.id, email: result.user.email, name: result.user.name });
await client.end();
