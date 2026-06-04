/**
 * Replace W4 questions with the revised set from
 * Workshop_CoreBusiness_Revised_1.docx.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/replace-w4-questions.ts
 *
 * WARNING: This deletes existing W4 questions (cascade also drops
 * any responses, comments, history, and anonymous responses on them).
 *
 * 24 prompts in workshop order, grouped into 8 sections.
 * No role-specific questions in this revision — all are visible to everyone.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { workshop, question } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

interface Row {
	section: string;
	prompt: string;
}

const PROMPTS: Row[] = [
	// ── Block 1 ─────────────────────────────────────────
	{
		section: 'Block 1 — Activity inventory',
		prompt:
			'Q1. List every major business activity at Lummus Consultants today — from winning new work through to closing an engagement. What are the big categories?'
	},
	{
		section: 'Block 1 — Activity inventory',
		prompt:
			'Q2. For each activity, who owns it, and how much of the team’s time does it consume in a typical month?'
	},
	{
		section: 'Block 1 — Activity inventory',
		prompt:
			'Q3. For which of these activities would the firm genuinely struggle if one specific person were unavailable for a month? Where does institutional capability actually depend on individuals?'
	},
	{
		section: 'Block 1 — Activity inventory',
		prompt:
			'Q4. Are there activities that happen informally or ad hoc that aren’t captured in any process today?'
	},
	{
		section: 'Block 1 — Activity inventory',
		prompt:
			'Q4a. Which activities feel mismatched — tasks that shouldn’t require someone at your level? For each, what would be more appropriate?'
	},

	// ── Block 2 ─────────────────────────────────────────
	{
		section: 'Block 2 — Business development',
		prompt:
			'Q5. How does Lummus Consultants win new work today? Walk me through how a typical new engagement originates — inbound, relationship, referral, competitive bid.'
	},
	{
		section: 'Block 2 — Business development',
		prompt:
			'Q6. When you put together a proposal, what do you reuse from past work, and how do you find it? What does a winning pitch depend on?'
	},
	{
		section: 'Block 2 — Business development',
		prompt:
			'Q7. Where does the relationship knowledge live — which clients trust whom, who is the relationship owner? What happens to that if the person is unavailable?'
	},
	{
		section: 'Block 2 — Business development',
		prompt:
			'Q8. When you win, do you know why? When you lose, do you know why? Is any of that captured anywhere, or does each pursuit start fresh?'
	},
	{
		section: 'Block 2 — Business development',
		prompt:
			'Q9. How well can leadership see the BD pipeline at any given moment — what’s in flight, what’s likely, what’s at risk?'
	},

	// ── Block 3 ─────────────────────────────────────────
	{
		section: 'Block 3 — Resource management',
		prompt:
			'Q10. How do you decide who staffs a given engagement? What does that decision depend on — availability, expertise, client relationship, who’s done similar work before and/or other considerations?'
	},
	{
		section: 'Block 3 — Resource management',
		prompt:
			'Q11. Where does the knowledge of “who’s good at what” live today? Is it written down anywhere, or does it depend on a few people knowing the team?'
	},
	{
		section: 'Block 3 — Resource management',
		prompt:
			'Q12. How well can you see capacity and availability across the team at any moment? When you need to staff something quickly, how do you know who’s free?'
	},
	{
		section: 'Block 3 — Resource management',
		prompt:
			'Q13. When the right person for an engagement isn’t available, how often does work get staffed with second-choice fit — and what’s the cost of that in quality, speed, or client experience?'
	},
	{
		section: 'Block 3 — Resource management',
		prompt:
			'Q14. How do you balance keeping people utilized against not overloading them? Where does that tension show up, and how is it managed today?'
	},

	// ── Block 4 ─────────────────────────────────────────
	{
		section: 'Block 4 — Systems of record',
		prompt:
			'Q15. For each major activity, what system or tool is the official home — Planisware, SharePoint, a DMS, spreadsheets? And where do people keep the real working version? Where do the system of record and the real work diverge?'
	},

	// ── Block 5 ─────────────────────────────────────────
	{
		section: 'Block 5 — Objectives & measurement',
		prompt: 'Q16. For each business activity, what is the primary objective? What does “success” look like?'
	},
	{
		section: 'Block 5 — Objectives & measurement',
		prompt:
			'Q17. How do you know whether each activity is meeting its objective — KPIs, or intuition? And are there objectives that genuinely matter but that nothing currently measures or captures?'
	},

	// ── Block 6 ─────────────────────────────────────────
	{
		section: 'Block 6 — Honest assessment',
		prompt:
			'Q18. Which objectives are you confidently hitting, and where are the biggest gaps between what an activity is supposed to achieve and what actually happens?'
	},
	{
		section: 'Block 6 — Honest assessment',
		prompt:
			'Q18a. If you could spend more time working on one objective you know you should be working on but aren’t yet, which one would it be — and why that one specifically?'
	},

	// ── Block 7 ─────────────────────────────────────────
	{
		section: 'Block 7 — Differentiation & future',
		prompt:
			'Q19. Where does Lummus Consultants genuinely outperform competitors — and what does that advantage depend on staying true?'
	},
	{
		section: 'Block 7 — Differentiation & future',
		prompt:
			'Q20. Looking two to three years out: what’s changing in your market or your clients’ world that could change how this firm needs to work?'
	},
	{
		section: 'Block 7 — Differentiation & future',
		prompt: 'Q21. Are there business activities you know you should be doing but aren’t yet — things on the roadmap or wish list?'
	},

	// ── Block 8 ─────────────────────────────────────────
	{
		section: 'Block 8 — Prioritization',
		prompt:
			'Q22. If you had to rank these activities by strategic importance to Lummus Consultants over the next 12 months, what comes out on top?'
	}
];

async function main() {
	const [ws] = await db.select().from(workshop).where(eq(workshop.code, 'W4')).limit(1);
	if (!ws) throw new Error('Workshop W4 not found');

	const before = await db
		.select({ id: question.id })
		.from(question)
		.where(eq(question.workshopId, ws.id));
	console.log(
		`→ Deleting ${before.length} existing W4 questions (cascade drops responses/comments/history)…`
	);
	await db.delete(question).where(eq(question.workshopId, ws.id));

	console.log(`→ Inserting ${PROMPTS.length} revised W4 questions…`);
	const rows = PROMPTS.map((p) => ({
		workshopId: ws.id,
		prompt: p.prompt,
		section: p.section,
		status: 'open' as const,
		published: true
	}));
	const inserted = await db.insert(question).values(rows).returning({ id: question.id });

	console.log(`✓ Replaced. W4 now has ${inserted.length} questions across 8 blocks.`);
	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
