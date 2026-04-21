<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Progress } from '$lib/components/ui/progress';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Circle from '@lucide/svelte/icons/circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Users from '@lucide/svelte/icons/users';
	import Clock from '@lucide/svelte/icons/clock';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { page } from '$app/state';

	let { data } = $props();
	const currentUserId = $derived(page.data.user?.id ?? null);
	let expandedQuestions = $state<Set<number>>(new Set());

	const toggleExpanded = (id: number) => {
		const next = new Set(expandedQuestions);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedQuestions = next;
	};

	const fmtCommentTime = (d: string | Date) =>
		new Date(d).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

	const totalHours = $derived(data.hours.reduce((s, h) => s + Number(h.hours), 0));
	const answered = $derived(data.questions.filter((q) => q.status === 'answered').length);
	const pct = $derived(
		data.questions.length ? Math.round((answered / data.questions.length) * 100) : 0
	);

	const statusIcon = (s: string) =>
		s === 'completed' ? CircleCheck : s === 'in_progress' ? CircleDot : Circle;
	const statusColor = (s: string) =>
		s === 'completed'
			? 'text-emerald-600'
			: s === 'in_progress'
				? 'text-amber-600'
				: 'text-muted-foreground';

	let editWorkshopOpen = $state(false);
	let editingQuestionId = $state<number | null>(null);
	let addQuestionOpen = $state(false);
	let addHoursOpen = $state(false);
	let addParticipantOpen = $state(false);

	const nonParticipants = $derived(() => {
		const ids = new Set(data.participants.map((p) => p.id));
		return data.allMembers.filter((m) => !ids.has(m.id));
	});

	const questionStatusVariant = (s: string) =>
		s === 'answered' ? 'default' : s === 'deferred' ? 'secondary' : 'outline';
</script>

<div class="mx-auto max-w-5xl px-6 py-8">
	<Button href="/workshops" variant="ghost" size="sm" class="mb-4 gap-1">
		<ArrowLeft class="size-4" /> Workshops
	</Button>

	<header class="mb-6 flex items-start justify-between gap-4">
		<div class="min-w-0">
			<div class="text-muted-foreground font-mono text-xs">
				{data.workshop.code} · Week {data.workshop.weekNumber ?? '—'} · {data.workshop
					.sessionDurationMinutes} min{#if data.workshop.scheduledAt} · {new Date(
						data.workshop.scheduledAt
					).toLocaleString(undefined, {
						weekday: 'short',
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					})}{/if}
			</div>
			<div class="flex items-center gap-3">
				<h1 class="truncate text-2xl font-semibold tracking-tight">{data.workshop.title}</h1>
				{#snippet StatusIcon()}
					{@const Icon = statusIcon(data.workshop.status)}
					<Icon class="size-4 {statusColor(data.workshop.status)}" />
				{/snippet}
				<Badge variant="outline" class="gap-1">
					{@render StatusIcon()}
					{data.workshop.status.replace('_', ' ')}
				</Badge>
			</div>
			<p class="text-muted-foreground mt-2 text-sm">{data.workshop.description ?? ''}</p>
		</div>
		<Button variant="outline" size="sm" class="gap-1" onclick={() => (editWorkshopOpen = true)}>
			<Pencil class="size-3.5" /> Edit
		</Button>
	</header>

	<div class="mb-6">
		<div class="text-muted-foreground mb-1 flex justify-between text-xs">
			<span>{answered} of {data.questions.length} answered</span>
			<span>{pct}%</span>
		</div>
		<Progress value={pct} class="h-2" />
	</div>

	<div class="grid gap-6 md:grid-cols-[2fr_1fr]">
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title class="text-base">Questions ({data.questions.length})</Card.Title>
					<Button size="sm" variant="outline" class="gap-1" onclick={() => (addQuestionOpen = true)}>
						<Plus class="size-3.5" /> Add
					</Button>
				</div>
			</Card.Header>
			<Card.Content class="space-y-2">
				{#each data.questions as q, i (q.id)}
					{@const expanded = expandedQuestions.has(q.id)}
					<div class="hover:bg-accent/30 group rounded-md border p-3 transition-colors">
						<div class="flex items-start gap-3">
							<span class="text-muted-foreground w-5 font-mono text-xs">{i + 1}</span>
							<div class="min-w-0 flex-1">
								<p class="text-sm">{q.prompt}</p>
								{#if q.answer}
									<p class="text-muted-foreground mt-1 border-l-2 pl-2 text-xs whitespace-pre-wrap">{q.answer}</p>
								{/if}
								<button
									type="button"
									class="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 text-xs transition-colors"
									onclick={() => toggleExpanded(q.id)}
								>
									<MessageSquare class="size-3.5" />
									{q.comments.length}
									{q.comments.length === 1 ? 'comment' : 'comments'}
									{expanded ? '· hide' : ''}
								</button>
							</div>
							<Badge variant={questionStatusVariant(q.status)} class="shrink-0">{q.status}</Badge>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
								onclick={() => (editingQuestionId = q.id)}
								aria-label="Edit question"
							>
								<Pencil class="size-3.5" />
							</button>
						</div>

						{#if expanded}
							<div class="border-border/60 mt-3 ml-8 space-y-2 border-l-2 pl-3">
								{#each q.comments as c (c.id)}
									<div class="group/comment flex items-start justify-between gap-2">
										<div class="min-w-0 flex-1">
											<div class="text-muted-foreground text-[11px]">
												<span class="text-foreground font-medium">{c.authorName ?? 'Unknown'}</span>
												· {fmtCommentTime(c.createdAt)}
											</div>
											<p class="text-sm whitespace-pre-wrap">{c.body}</p>
										</div>
										{#if c.authorUserId === currentUserId}
											<form
												method="POST"
												action="?/deleteComment"
												use:enhance={() => {
													return async ({ update }) => {
														await update();
														await invalidateAll();
													};
												}}
											>
												<input type="hidden" name="id" value={c.id} />
												<button
													type="submit"
													class="text-muted-foreground hover:text-destructive opacity-0 group-hover/comment:opacity-100"
													aria-label="Delete comment"
												>
													<Trash2 class="size-3" />
												</button>
											</form>
										{/if}
									</div>
								{:else}
									<p class="text-muted-foreground text-xs">No comments yet.</p>
								{/each}

								<form
									method="POST"
									action="?/addComment"
									class="flex gap-2 pt-1"
									use:enhance={() => {
										return async ({ update, formElement }) => {
											await update();
											formElement.reset();
											await invalidateAll();
										};
									}}
								>
									<input type="hidden" name="questionId" value={q.id} />
									<Textarea
										name="body"
										rows={1}
										required
										placeholder="Add a comment…"
										class="min-h-[32px] text-sm"
									/>
									<Button type="submit" size="sm" variant="outline">Post</Button>
								</form>
							</div>
						{/if}
					</div>
				{/each}
				{#if data.questions.length === 0}
					<p class="text-muted-foreground py-4 text-center text-sm">No questions yet.</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<Card.Title class="flex items-center gap-2 text-base">
							<Users class="size-4" /> Participants ({data.participants.length})
						</Card.Title>
						<Button
							size="sm"
							variant="outline"
							class="gap-1"
							disabled={nonParticipants().length === 0}
							onclick={() => (addParticipantOpen = true)}
						>
							<Plus class="size-3.5" />
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="space-y-2">
					{#each data.participants as p (p.id)}
						<div class="group flex items-start justify-between gap-2">
							<div class="min-w-0">
								<div class="truncate text-sm">{p.name}</div>
								<div class="text-muted-foreground truncate text-xs">
									{p.role}{p.organization ? ` · ${p.organization}` : ''}
								</div>
							</div>
							<form
								method="POST"
								action="?/removeParticipant"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										await invalidateAll();
									};
								}}
							>
								<input type="hidden" name="teamMemberId" value={p.id} />
								<button
									type="submit"
									class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
									aria-label="Remove participant"
								>
									<Trash2 class="size-3.5" />
								</button>
							</form>
						</div>
					{/each}
					{#if data.participants.length === 0}
						<p class="text-muted-foreground text-center text-sm">No participants.</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<Card.Title class="flex items-center gap-2 text-base">
							<Clock class="size-4" /> Hours ({totalHours}h)
						</Card.Title>
						<Button size="sm" variant="outline" class="gap-1" onclick={() => (addHoursOpen = true)}>
							<Plus class="size-3.5" />
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="space-y-1 text-sm">
					{#each data.hours as h (h.id)}
						<div class="group flex items-center justify-between gap-2">
							<span class="text-muted-foreground truncate text-xs">
								{h.memberName ?? '—'} · {h.kind}
							</span>
							<div class="flex items-center gap-2">
								<span class="font-mono text-xs">{h.hours}h</span>
								<form
									method="POST"
									action="?/deleteHours"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
											await invalidateAll();
										};
									}}
								>
									<input type="hidden" name="id" value={h.id} />
									<button
										type="submit"
										class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
										aria-label="Delete entry"
									>
										<Trash2 class="size-3.5" />
									</button>
								</form>
							</div>
						</div>
					{:else}
						<p class="text-muted-foreground text-xs">No entries yet.</p>
					{/each}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<!-- Edit workshop dialog -->
<Dialog.Root bind:open={editWorkshopOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit workshop</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/updateWorkshop"
			class="space-y-4"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					editWorkshopOpen = false;
					await invalidateAll();
				};
			}}
		>
			<div class="space-y-2">
				<Label for="title">Title</Label>
				<Input id="title" name="title" value={data.workshop.title} required />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="weekNumber">Week</Label>
					<Input
						id="weekNumber"
						name="weekNumber"
						type="number"
						value={data.workshop.weekNumber ?? ''}
					/>
				</div>
				<div class="space-y-2">
					<Label for="status">Status</Label>
					<select
						id="status"
						name="status"
						value={data.workshop.status}
						class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
					>
						<option value="upcoming">Upcoming</option>
						<option value="in_progress">In progress</option>
						<option value="completed">Completed</option>
						<option value="cancelled">Cancelled</option>
					</select>
				</div>
			</div>
			<div class="space-y-2">
				<Label for="scheduledAt">Scheduled at</Label>
				<Input
					id="scheduledAt"
					name="scheduledAt"
					type="datetime-local"
					value={data.workshop.scheduledAt
						? new Date(data.workshop.scheduledAt).toISOString().slice(0, 16)
						: ''}
				/>
			</div>
			<div class="space-y-2">
				<Label for="description">Description</Label>
				<Textarea
					id="description"
					name="description"
					rows={4}
					value={data.workshop.description ?? ''}
				/>
			</div>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (editWorkshopOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Add question dialog -->
<Dialog.Root bind:open={addQuestionOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add question</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/addQuestion"
			class="space-y-4"
			use:enhance={() => {
				return async ({ update, formElement }) => {
					await update();
					formElement.reset();
					addQuestionOpen = false;
					await invalidateAll();
				};
			}}
		>
			<div class="space-y-2">
				<Label for="new-prompt">Prompt</Label>
				<Textarea id="new-prompt" name="prompt" rows={3} required />
			</div>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (addQuestionOpen = false)}>
					Cancel
				</Button>
				<Button type="submit" class="gap-1"><Plus class="size-3.5" /> Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit question dialog -->
{#if editingQuestionId != null}
	{@const q = data.questions.find((x) => x.id === editingQuestionId)}
	{#if q}
		<Dialog.Root
			open={true}
			onOpenChange={(v) => {
				if (!v) editingQuestionId = null;
			}}
		>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Edit question</Dialog.Title>
				</Dialog.Header>
				<form
					method="POST"
					action="?/updateQuestion"
					class="space-y-4"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							editingQuestionId = null;
							await invalidateAll();
						};
					}}
				>
					<input type="hidden" name="id" value={q.id} />
					<div class="space-y-2">
						<Label for="edit-prompt">Prompt</Label>
						<Textarea id="edit-prompt" name="prompt" rows={3} value={q.prompt} required />
					</div>
					<div class="space-y-2">
						<Label for="edit-answer">Answer</Label>
						<Textarea id="edit-answer" name="answer" rows={5} value={q.answer ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="edit-q-status">Status</Label>
						<select
							id="edit-q-status"
							name="status"
							value={q.status}
							class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
						>
							<option value="open">Open</option>
							<option value="answered">Answered</option>
							<option value="deferred">Deferred</option>
						</select>
					</div>
					<Dialog.Footer class="justify-between">
						<button
							type="submit"
							formaction="?/deleteQuestion"
							class="{buttonVariants({ variant: 'ghost', size: 'sm' })} text-destructive"
						>
							<Trash2 class="mr-1 size-3.5" /> Delete
						</button>
						<div class="flex gap-2">
							<Button variant="outline" type="button" onclick={() => (editingQuestionId = null)}>
								Cancel
							</Button>
							<Button type="submit" class="gap-1"><Check class="size-3.5" /> Save</Button>
						</div>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	{/if}
{/if}

<!-- Add hours dialog -->
<Dialog.Root bind:open={addHoursOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Log hours</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/addHours"
			class="space-y-4"
			use:enhance={() => {
				return async ({ update, formElement }) => {
					await update();
					formElement.reset();
					addHoursOpen = false;
					await invalidateAll();
				};
			}}
		>
			<div class="space-y-2">
				<Label for="h-member">Member</Label>
				<select
					id="h-member"
					name="teamMemberId"
					required
					class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
				>
					<option value="" disabled selected>Choose…</option>
					{#each data.allMembers as m (m.id)}
						<option value={m.id}>{m.name}</option>
					{/each}
				</select>
			</div>
			<div class="grid grid-cols-[1fr_auto] gap-3">
				<div class="space-y-2">
					<Label for="h-kind">Kind</Label>
					<Input id="h-kind" name="kind" placeholder="e.g. session" required />
				</div>
				<div class="space-y-2">
					<Label for="h-hours">Hours</Label>
					<Input id="h-hours" name="hours" type="number" step="0.25" class="w-24" required />
				</div>
			</div>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (addHoursOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Log</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Add participant dialog -->
<Dialog.Root bind:open={addParticipantOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add participant</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/addParticipant"
			class="space-y-4"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					addParticipantOpen = false;
					await invalidateAll();
				};
			}}
		>
			<div class="space-y-2">
				<Label for="p-member">Member</Label>
				<select
					id="p-member"
					name="teamMemberId"
					required
					class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
				>
					<option value="" disabled selected>Choose…</option>
					{#each nonParticipants() as m (m.id)}
						<option value={m.id}>{m.name}{m.role ? ` — ${m.role}` : ''}</option>
					{/each}
				</select>
			</div>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (addParticipantOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
