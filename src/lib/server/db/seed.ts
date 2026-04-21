import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
	workshop,
	teamMember,
	workshopParticipant,
	question,
	hoursEntry
} from './schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function main() {
	console.log('→ Clearing existing data…');
	await db.delete(hoursEntry);
	await db.delete(question);
	await db.delete(workshopParticipant);
	await db.delete(workshop);
	await db.delete(teamMember);

	console.log('→ Inserting workshops…');
	const [w1, w2, w3, w4] = await db
		.insert(workshop)
		.values([
			{
				code: 'W1',
				title: 'Consultant Workflow & Knowledge Pain Points',
				description:
					'Map how consultants actually work day-to-day: where time is wasted, where knowledge is lost, and which tasks they wish they could delegate. No preparation required from participants.',
				weekNumber: 1,
				sessionDurationMinutes: 120,
				status: 'upcoming'
			},
			{
				code: 'W2',
				title: 'IT Landscape & Systems Baseline',
				description:
					'Validate IT hypotheses, map the current solution landscape, identify integration constraints, and understand what the IT team can realistically support. Feeds directly into Phase 3 architecture.',
				weekNumber: 2,
				sessionDurationMinutes: 120,
				status: 'upcoming'
			},
			{
				code: 'W3',
				title: 'Invoice Process, Finance & External Integrations',
				description:
					'Map the end-to-end invoice lifecycle from engagement sign-off to payment collection, identify pain points in the current finance workflow, and evaluate integration opportunities with external accounting and ERP solutions.',
				weekNumber: 3,
				sessionDurationMinutes: 120,
				status: 'in_progress'
			},
			{
				code: 'W4',
				title: 'Core Business Activities & Strategic Objectives',
				description:
					"Produce a comprehensive inventory of Lummus's core business activities and the strategic objectives behind each one — from business development and client delivery to internal operations and knowledge management.",
				weekNumber: 4,
				sessionDurationMinutes: 120,
				status: 'upcoming'
			}
		])
		.returning();

	const byCode = new Map([
		['W1', w1],
		['W2', w2],
		['W3', w3],
		['W4', w4]
	]);

	console.log('→ Inserting team members…');
	const members = await db
		.insert(teamMember)
		.values([
			{ name: 'External Programme Lead', role: 'External Programme Lead', organization: 'External' },
			{ name: 'Designated Project Lead', role: 'Designated Project Lead (DPL)', organization: 'Lummus' },
			{ name: 'Project Sponsor', role: 'Project Sponsor', organization: 'Lummus' },
			{ name: 'Senior Consultant A', role: 'Senior Consultant', organization: 'Lummus' },
			{ name: 'Senior Consultant B', role: 'Senior Consultant', organization: 'Lummus' },
			{ name: 'Finance / Operations Lead', role: 'Finance / Operations Lead', organization: 'Lummus' },
			{ name: 'IT Lead', role: 'IT Lead', organization: 'Lummus' }
		])
		.returning();

	const member = Object.fromEntries(members.map((m) => [m.name, m]));

	console.log('→ Linking participants to workshops…');
	const participations: { workshopId: number; teamMemberId: number }[] = [];
	const link = (name: string, codes: string[]) => {
		for (const c of codes) {
			participations.push({
				workshopId: byCode.get(c)!.id,
				teamMemberId: member[name].id
			});
		}
	};
	link('External Programme Lead', ['W1', 'W2', 'W3', 'W4']);
	link('Designated Project Lead', ['W1', 'W2', 'W3', 'W4']);
	link('Project Sponsor', ['W4']);
	link('Senior Consultant A', ['W1']);
	link('Senior Consultant B', ['W1']);
	link('Finance / Operations Lead', ['W3']);
	link('IT Lead', ['W2']);
	await db.insert(workshopParticipant).values(participations);

	console.log('→ Logging hours…');
	await db.insert(hoursEntry).values([
		{ workshopId: w1.id, teamMemberId: member['External Programme Lead'].id, kind: 'prep+session+synthesis', hours: '8' },
		{ workshopId: w2.id, teamMemberId: member['External Programme Lead'].id, kind: 'prep+session+synthesis', hours: '8' },
		{ workshopId: w3.id, teamMemberId: member['External Programme Lead'].id, kind: 'prep+session+synthesis', hours: '8' },
		{ workshopId: w4.id, teamMemberId: member['External Programme Lead'].id, kind: 'prep+session+synthesis', hours: '8' },
		{ workshopId: null, teamMemberId: member['External Programme Lead'].id, kind: 'deliverables writing', hours: '8' },
		{ workshopId: w1.id, teamMemberId: member['Designated Project Lead'].id, kind: 'session + debrief', hours: '2.5' },
		{ workshopId: w2.id, teamMemberId: member['Designated Project Lead'].id, kind: 'session + debrief', hours: '2.5' },
		{ workshopId: w3.id, teamMemberId: member['Designated Project Lead'].id, kind: 'session + debrief', hours: '2.5' },
		{ workshopId: w4.id, teamMemberId: member['Designated Project Lead'].id, kind: 'session + debrief', hours: '2.5' }
	]);

	console.log('→ Inserting questions…');
	const qs: { workshop: string; prompts: string[] }[] = [
		{
			workshop: 'W1',
			prompts: [
				'Walk me through a typical engagement from kickoff to final report. Where do you personally spend the most time?',
				'How do you start a new engagement — what do you do in the first week?',
				'How much of a typical engagement report is genuinely new versus adapted from previous work?',
				'Where do you store your working notes, interim findings, and draft analyses?',
				'What happens to engagement knowledge when a project closes?',
				'Have you ever wished you could search across all past engagement reports at once?',
				"Which tasks feel like they shouldn't require a senior consultant?",
				'How do you currently manage client questions and data requests during an engagement?',
				'If you had an AI assistant for one task only, what would you give it?'
			]
		},
		{
			workshop: 'W2',
			prompts: [
				'Walk me through your current technology stack — what are the main systems and what does each one do?',
				'How is Microsoft 365 actually used — specifically SharePoint and Teams?',
				'How is your IT team structured — how many people, what are the roles, and who is responsible for what?',
				'Do you have dedicated IT support staff, or is IT managed alongside other responsibilities?',
				'Who owns the relationship between IT and the rest of the business — is there a business analyst or project manager role?',
				'What project management tools are currently in use?',
				'Where is data hosted today — on-premise, cloud, or hybrid?',
				'What is your current security and compliance posture — ISO 27001, Cyber Essentials, SOC 2?',
				'What are the biggest IT pain points you personally deal with today?',
				'What is your approach to disaster recovery and business continuity — and are there active vendor contracts or licence renewals coming up in the next 12 months?'
			]
		},
		{
			workshop: 'W3',
			prompts: [
				'Walk me through the invoice lifecycle: from the moment an engagement is signed off to the point payment is received.',
				'Who is responsible for creating, approving, and sending invoices today, and what tools do they use?',
				'How do you handle milestone-based or phased billing — is it manual or linked to project milestones?',
				'What accounting or finance systems are currently in use (e.g., Xero, QuickBooks, Sage), and how well do they integrate with your other tools?',
				'Where do invoices and payment records live today — and can you easily reconcile them against engagement data?',
				'What are the biggest pain points in your current invoicing process (e.g., late payments, manual data entry, reconciliation errors)?',
				'Have you evaluated any integrations between your PM/CRM tools and your accounting system to automate invoice generation?',
				'If you could automate one part of the finance or invoicing workflow tomorrow, what would have the biggest impact?',
				'Are there multi-currency, cross-border, or VAT considerations in your invoicing — and how is audit trail compliance managed today?'
			]
		},
		{
			workshop: 'W4',
			prompts: [
				'List every major business activity at Lummus today — from winning new work through to closing an engagement. What are the big categories?',
				"For each activity, who owns it and how much of the team's time does it consume in a typical month?",
				"Are there activities that happen informally or ad hoc that aren't captured in any process today?",
				'For each business activity, what is the primary objective? What does "success" look like?',
				'How do you measure whether each activity is meeting its objective today? Are there KPIs or is it intuition-based?',
				"Which objectives are you confidently hitting, and which ones feel like they're falling short?",
				'Where are the biggest gaps between what an activity is supposed to achieve and what actually happens?',
				"Are there business activities you know you should be doing but aren't yet — things on the roadmap or wish list?",
				'If you had to rank these activities by strategic importance to Lummus over the next 12 months, what comes out on top?'
			]
		}
	];

	const questionRows = qs.flatMap((q) =>
		q.prompts.map((prompt) => ({
			workshopId: byCode.get(q.workshop)!.id,
			prompt,
			status: 'open' as const
		}))
	);
	await db.insert(question).values(questionRows);

	console.log('✓ Seed complete');
	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
