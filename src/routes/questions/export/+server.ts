import ExcelJS from 'exceljs';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	question,
	questionComment,
	questionResponse,
	workshop,
	user
} from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admin only');
	}

	const questions = await db
		.select({
			id: question.id,
			prompt: question.prompt,
			answer: question.answer,
			status: question.status,
			published: question.published,
			workshopCode: workshop.code,
			workshopTitle: workshop.title,
			weekNumber: workshop.weekNumber
		})
		.from(question)
		.innerJoin(workshop, eq(question.workshopId, workshop.id))
		.orderBy(asc(workshop.weekNumber), asc(question.id));

	const comments = await db
		.select({
			id: questionComment.id,
			questionId: questionComment.questionId,
			body: questionComment.body,
			createdAt: questionComment.createdAt,
			authorName: user.name,
			authorEmail: user.email
		})
		.from(questionComment)
		.leftJoin(user, eq(user.id, questionComment.authorUserId))
		.orderBy(asc(questionComment.questionId), asc(questionComment.createdAt));

	const responses = await db
		.select({
			id: questionResponse.id,
			questionId: questionResponse.questionId,
			body: questionResponse.body,
			updatedAt: questionResponse.updatedAt,
			userName: user.name,
			userEmail: user.email
		})
		.from(questionResponse)
		.leftJoin(user, eq(user.id, questionResponse.userId))
		.orderBy(asc(questionResponse.questionId), asc(questionResponse.updatedAt));

	// Index questions by id for cross-sheet lookup
	const qById = new Map(questions.map((q) => [q.id, q]));
	// Per-workshop running question number
	const qNumByWorkshop = new Map<string, number>();
	const qNumberMap = new Map<number, number>();
	for (const q of questions) {
		const next = (qNumByWorkshop.get(q.workshopCode) ?? 0) + 1;
		qNumByWorkshop.set(q.workshopCode, next);
		qNumberMap.set(q.id, next);
	}

	const wb = new ExcelJS.Workbook();
	wb.creator = 'Lummus';
	wb.created = new Date();

	// ── Sheet 1: Questions ────────────────────────────────────────────
	const qs = wb.addWorksheet('Questions', {
		views: [{ state: 'frozen', ySplit: 1 }]
	});
	qs.columns = [
		{ header: 'Workshop', key: 'ws', width: 10 },
		{ header: 'Week', key: 'week', width: 6 },
		{ header: 'Q#', key: 'qnum', width: 5 },
		{ header: 'Visibility', key: 'visibility', width: 11 },
		{ header: 'Prompt', key: 'prompt', width: 60 },
		{ header: 'Status', key: 'status', width: 12 },
		{ header: 'Official answer', key: 'answer', width: 60 },
		{ header: 'Comments', key: 'nComments', width: 10 },
		{ header: 'Responses', key: 'nResponses', width: 10 }
	];
	for (const q of questions) {
		qs.addRow({
			ws: q.workshopCode,
			week: q.weekNumber,
			qnum: qNumberMap.get(q.id),
			visibility: q.published ? 'published' : 'draft',
			prompt: q.prompt,
			status: q.status,
			answer: q.answer ?? '',
			nComments: comments.filter((c) => c.questionId === q.id).length,
			nResponses: responses.filter((r) => r.questionId === q.id).length
		});
	}
	qs.getRow(1).font = { bold: true };
	qs.eachRow((row) => {
		row.alignment = { vertical: 'top', wrapText: true };
	});

	// ── Sheet 2: Comments ─────────────────────────────────────────────
	const cs = wb.addWorksheet('Comments', {
		views: [{ state: 'frozen', ySplit: 1 }]
	});
	cs.columns = [
		{ header: 'Workshop', key: 'ws', width: 10 },
		{ header: 'Q#', key: 'qnum', width: 5 },
		{ header: 'Prompt', key: 'prompt', width: 50 },
		{ header: 'Author', key: 'author', width: 24 },
		{ header: 'Email', key: 'email', width: 30 },
		{ header: 'When', key: 'when', width: 18 },
		{ header: 'Comment', key: 'body', width: 60 }
	];
	for (const c of comments) {
		const q = qById.get(c.questionId);
		cs.addRow({
			ws: q?.workshopCode ?? '',
			qnum: qNumberMap.get(c.questionId),
			prompt: q?.prompt ?? '',
			author: c.authorName ?? '—',
			email: c.authorEmail ?? '',
			when: c.createdAt,
			body: c.body
		});
	}
	cs.getRow(1).font = { bold: true };
	cs.getColumn('when').numFmt = 'yyyy-mm-dd hh:mm';
	cs.eachRow((row) => {
		row.alignment = { vertical: 'top', wrapText: true };
	});

	// ── Sheet 3: Responses ────────────────────────────────────────────
	const rs = wb.addWorksheet('Responses', {
		views: [{ state: 'frozen', ySplit: 1 }]
	});
	rs.columns = [
		{ header: 'Workshop', key: 'ws', width: 10 },
		{ header: 'Q#', key: 'qnum', width: 5 },
		{ header: 'Prompt', key: 'prompt', width: 50 },
		{ header: 'User', key: 'user', width: 24 },
		{ header: 'Email', key: 'email', width: 30 },
		{ header: 'Updated', key: 'updated', width: 18 },
		{ header: 'Response', key: 'body', width: 60 }
	];
	for (const r of responses) {
		const q = qById.get(r.questionId);
		rs.addRow({
			ws: q?.workshopCode ?? '',
			qnum: qNumberMap.get(r.questionId),
			prompt: q?.prompt ?? '',
			user: r.userName ?? '—',
			email: r.userEmail ?? '',
			updated: r.updatedAt,
			body: r.body
		});
	}
	rs.getRow(1).font = { bold: true };
	rs.getColumn('updated').numFmt = 'yyyy-mm-dd hh:mm';
	rs.eachRow((row) => {
		row.alignment = { vertical: 'top', wrapText: true };
	});

	const buffer = await wb.xlsx.writeBuffer();
	const stamp = new Date().toISOString().slice(0, 10);

	return new Response(buffer, {
		headers: {
			'Content-Type':
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="lummus-questions-${stamp}.xlsx"`,
			'Cache-Control': 'no-store'
		}
	});
};
