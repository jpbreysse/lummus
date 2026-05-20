import {
	pgTable,
	serial,
	integer,
	text,
	timestamp,
	numeric,
	pgEnum,
	index,
	boolean
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['admin', 'user']);

// ─── User (Better Auth identity + programme participation) ───────────
// A `user` row is the single source of truth for a person — login,
// stakeholder profile, programme participant. Some users have a
// password (in `account`) and can sign in. Others are "stakeholder-only"
// rows we track but who don't log in.
export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	role: userRole('role').notNull().default('user'),
	organization: text('organization'),
	workshopRole: text('workshop_role'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const announcement = pgTable('announcement', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	body: text('body').notNull(),
	pinned: boolean('pinned').notNull().default(false),
	authorUserId: text('author_user_id').references(() => user.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const invite = pgTable('invite', {
	id: serial('id').primaryKey(),
	code: text('code').notNull().unique(),
	email: text('email'),
	createdByUserId: text('created_by_user_id').references(() => user.id, {
		onDelete: 'set null'
	}),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
	usedAt: timestamp('used_at', { withTimezone: true }),
	usedByUserId: text('used_by_user_id').references(() => user.id, { onDelete: 'set null' })
});

export const workshopStatus = pgEnum('workshop_status', [
	'upcoming',
	'in_progress',
	'completed',
	'cancelled'
]);

export const questionStatus = pgEnum('question_status', [
	'open',
	'answered',
	'deferred'
]);

export const workshop = pgTable('workshop', {
	id: serial('id').primaryKey(),
	code: text('code').notNull().unique(),
	title: text('title').notNull(),
	description: text('description'),
	weekNumber: integer('week_number'),
	sessionDurationMinutes: integer('session_duration_minutes').notNull().default(120),
	status: workshopStatus('status').notNull().default('upcoming'),
	scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const workshopParticipant = pgTable(
	'workshop_participant',
	{
		workshopId: integer('workshop_id')
			.notNull()
			.references(() => workshop.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(t) => [
		index('workshop_participant_workshop_idx').on(t.workshopId),
		index('workshop_participant_user_idx').on(t.userId)
	]
);

export const question = pgTable(
	'question',
	{
		id: serial('id').primaryKey(),
		workshopId: integer('workshop_id')
			.notNull()
			.references(() => workshop.id, { onDelete: 'cascade' }),
		prompt: text('prompt').notNull(),
		answer: text('answer'),
		status: questionStatus('status').notNull().default('open'),
		published: boolean('published').notNull().default(true),
		// NULL = shown to all participants.
		// 'PM' / 'Engineer' = shown only to participants whose workshopRole matches.
		targetRole: text('target_role'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('question_workshop_idx').on(t.workshopId)]
);

// Internal effort tracking — admin-only. Independent from `hoursEntry`
// (which ties hours to workshops). Use this for any work that isn't
// scoped to a specific workshop: prep, deliverables, off-cycle calls,
// etc.
export const effortLog = pgTable(
	'effort_log',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
		description: text('description').notNull(),
		hours: numeric('hours', { precision: 6, scale: 2 }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('effort_log_user_idx').on(t.userId), index('effort_log_date_idx').on(t.date)]
);

export const hoursEntry = pgTable(
	'hours_entry',
	{
		id: serial('id').primaryKey(),
		workshopId: integer('workshop_id').references(() => workshop.id, {
			onDelete: 'set null'
		}),
		userId: text('user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		kind: text('kind').notNull(),
		hours: numeric('hours', { precision: 6, scale: 2 }).notNull(),
		notes: text('notes'),
		loggedOn: timestamp('logged_on', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('hours_workshop_idx').on(t.workshopId),
		index('hours_user_idx').on(t.userId)
	]
);

export const workshopRelations = relations(workshop, ({ many }) => ({
	participants: many(workshopParticipant),
	questions: many(question),
	hours: many(hoursEntry)
}));

export const workshopParticipantRelations = relations(workshopParticipant, ({ one }) => ({
	workshop: one(workshop, {
		fields: [workshopParticipant.workshopId],
		references: [workshop.id]
	}),
	user: one(user, {
		fields: [workshopParticipant.userId],
		references: [user.id]
	})
}));

export const questionHistory = pgTable(
	'question_history',
	{
		id: serial('id').primaryKey(),
		questionId: integer('question_id')
			.notNull()
			.references(() => question.id, { onDelete: 'cascade' }),
		actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
		action: text('action').notNull(), // 'created' | 'prompt' | 'answer' | 'status' | 'deleted'
		oldValue: text('old_value'),
		newValue: text('new_value'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('question_history_question_idx').on(t.questionId)]
);

export const questionResponse = pgTable(
	'question_response',
	{
		id: serial('id').primaryKey(),
		questionId: integer('question_id')
			.notNull()
			.references(() => question.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('question_response_question_idx').on(t.questionId),
		index('question_response_user_idx').on(t.userId),
		index('question_response_unique').on(t.questionId, t.userId)
	]
);

// Anonymous responses — no user_id by design. Once posted, no one (admin
// included) can trace them back to the author. This is intentional and
// permanent: the row stores only the body and timestamp.
export const questionAnonymousResponse = pgTable(
	'question_anonymous_response',
	{
		id: serial('id').primaryKey(),
		questionId: integer('question_id')
			.notNull()
			.references(() => question.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('question_anonymous_response_question_idx').on(t.questionId)]
);

export const questionComment = pgTable(
	'question_comment',
	{
		id: serial('id').primaryKey(),
		questionId: integer('question_id')
			.notNull()
			.references(() => question.id, { onDelete: 'cascade' }),
		authorUserId: text('author_user_id').references(() => user.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('question_comment_question_idx').on(t.questionId)]
);

export const questionRelations = relations(question, ({ one, many }) => ({
	workshop: one(workshop, {
		fields: [question.workshopId],
		references: [workshop.id]
	}),
	comments: many(questionComment)
}));

export const questionCommentRelations = relations(questionComment, ({ one }) => ({
	question: one(question, {
		fields: [questionComment.questionId],
		references: [question.id]
	}),
	author: one(user, {
		fields: [questionComment.authorUserId],
		references: [user.id]
	})
}));

export const hoursEntryRelations = relations(hoursEntry, ({ one }) => ({
	workshop: one(workshop, {
		fields: [hoursEntry.workshopId],
		references: [workshop.id]
	}),
	user: one(user, {
		fields: [hoursEntry.userId],
		references: [user.id]
	})
}));

export type Workshop = typeof workshop.$inferSelect;
export type NewWorkshop = typeof workshop.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Question = typeof question.$inferSelect;
export type NewQuestion = typeof question.$inferInsert;
export type HoursEntry = typeof hoursEntry.$inferSelect;
export type NewHoursEntry = typeof hoursEntry.$inferInsert;
