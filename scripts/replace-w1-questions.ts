/**
 * Replace W1 questions with the revised set from Workshop1_Revisions_3.docx.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/replace-w1-questions.ts
 *
 * WARNING: This deletes existing W1 questions (cascade also drops
 * any responses, comments, history, and anonymous responses on them).
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { workshop, question } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

/**
 * Revised W1 question set. 28 prompts in workshop order. The (PM) and
 * (Engineer) suffixes mark role-specific sub-questions kept verbatim
 * from the doc.
 */
const PROMPTS: string[] = [
	// Q1
	'Q1. Walk me through a typical engagement from kickoff to final report. Where do you personally spend the most time?',

	// Q2
	'Q2. How do you start a new engagement — what do you do in the first week?',
	'Q2a. What are the top 5 activities where your engagement time actually goes — the things you personally do? Roughly what share of your engagement time does each consume?',

	// Q3
	'Q3. How much of a typical engagement report is genuinely new versus adapted from previous work?',
	'Q3a. Which parts of your reports have a stable structure or methodology that carries across engagements?',
	'Q3b. When you need to reference how a similar issue was handled on a past project, how do you find that work today?',

	// Q4
	'Q4. Where do you store your working notes, interim findings, and draft analyses?',
	'Q4a (both roles). Where do you store your working notes, interim findings, and draft analyses during an engagement?',
	'Q4c (PM). Where do you store final reports, certificates, and other items formally submitted to the client? Do you keep archived versions of exactly what was submitted, and for how long?',
	'Q4c (Engineer). When your contribution becomes part of a final deliverable, do you know where it ends up stored, or what version was actually submitted to the client? Can you go back and look at it later if you need to?',

	// Q5
	'Q5. What happens to engagement knowledge when a project closes?',
	'Q5 (probe). Is any of this captured formally, or does it live in people’s heads?',
	'Q5a (Engineer). When an engagement closes, what (if anything) do you personally retain or carry forward into the next engagement? Do you have visibility into what the firm captures at the institutional level — and can you access it later if you need to?',
	'Q5b (PM). Do you share the final delivered work product with contributors? Do you provide feedback to individuals on the sections they authored — and if so, how is it done?',
	'Q5b (Engineer). Do you get to see the final delivered work product? Do you receive feedback on the sections you authored — and if so, how is it delivered? If not, what would you find most useful?',
	'Q5c (both roles). Do individual team members try to write their sections to match the style guide and existing quality standards, or do they tend to assume someone else — the PM or admin — will fix it on review?',

	// Q6
	'Q6. Have you ever wished you could search across all past engagement reports at once?',
	'Q6a. Tell me about a recent time when you needed to know “how did we handle X on a past project?” — for a proposal, a client question, expert testimony, or anything else. What was the situation, what did you end up doing, and how long did it take?',

	// Q7
	'Q7. Which tasks feel like they shouldn’t require a senior consultant?',
	'Q7a (downward delegation). Which activities feel mismatched — tasks that shouldn’t require someone at your level? For each, what would be more appropriate: a junior consultant, an admin, or an automated tool?',
	'Q7b (upward delegation). Conversely, what tasks are currently done by your manager(s) that you feel ready to take on? What’s stopping that today — capacity, formal authority, knowledge gaps, tooling, access to information?',

	// Q8
	'Q8. How do you currently manage client questions and data requests during an engagement?',
	'Q8 (probe). How does the RFI / data request process work — and who dictates it (you, or the client)?',
	'Q8 (probe). Where do you use your own templates or tools (e.g., document request lists) to shape it?',
	'Q8 (probe). What’s the biggest friction in this flow today — volume, timing, version control, traceability?',

	// Q9
	'Q9. If you had an AI assistant for one task only, what would you give it?',
	'Q9a. If you could hand one task to an AI assistant tomorrow, which one would it be — and why that one specifically?',
	'Q9b. Is there a task where you think the right fix is not AI — but better templates, a process change, or different staffing? Which one?'
];

async function main() {
	const [ws] = await db.select().from(workshop).where(eq(workshop.code, 'W1')).limit(1);
	if (!ws) throw new Error('Workshop W1 not found');

	const before = await db.select({ id: question.id }).from(question).where(eq(question.workshopId, ws.id));
	console.log(`→ Deleting ${before.length} existing W1 questions (cascade drops responses/comments/history)…`);
	await db.delete(question).where(eq(question.workshopId, ws.id));

	console.log(`→ Inserting ${PROMPTS.length} revised W1 questions…`);
	const rows = PROMPTS.map((prompt) => ({
		workshopId: ws.id,
		prompt,
		status: 'open' as const,
		published: true
	}));
	const inserted = await db.insert(question).values(rows).returning({ id: question.id });

	console.log(`✓ Replaced. W1 now has ${inserted.length} questions.`);
	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
