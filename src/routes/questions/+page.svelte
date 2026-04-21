<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Pencil from '@lucide/svelte/icons/pencil';

	let { data } = $props();
	let editingId = $state<number | null>(null);

	type Status = 'open' | 'answered' | 'deferred';
	let filter = $state<'all' | Status>('all');

	const filtered = $derived(
		filter === 'all' ? data.questions : data.questions.filter((q) => q.status === filter)
	);
	const counts = $derived({
		all: data.questions.length,
		open: data.questions.filter((q) => q.status === 'open').length,
		answered: data.questions.filter((q) => q.status === 'answered').length,
		deferred: data.questions.filter((q) => q.status === 'deferred').length
	});

	const statusVariant = (s: string) =>
		s === 'answered' ? 'default' : s === 'deferred' ? 'secondary' : 'outline';
</script>

<div class="mx-auto max-w-5xl px-6 py-8">
	<header class="mb-4 flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Questions</h1>
			<p class="text-muted-foreground text-sm">Across all workshops</p>
		</div>
	</header>

	<div class="mb-4 flex gap-1 text-sm">
		{#each [['all', 'All'], ['open', 'Open'], ['answered', 'Answered'], ['deferred', 'Deferred']] as const as [k, label] (k)}
			<button
				type="button"
				class="hover:bg-accent rounded-md border px-3 py-1 text-xs transition-colors {filter ===
				k
					? 'bg-accent font-medium'
					: 'text-muted-foreground'}"
				onclick={() => (filter = k)}
			>
				{label} <span class="ml-1 opacity-60">{counts[k]}</span>
			</button>
		{/each}
	</div>

	<div class="rounded-lg border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-16">WS</Table.Head>
					<Table.Head>Prompt</Table.Head>
					<Table.Head class="w-28">Status</Table.Head>
					<Table.Head class="w-12"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each filtered as q (q.id)}
					<Table.Row class="group">
						<Table.Cell>
							<a href="/workshops/{q.workshopCode}" class="font-mono text-xs hover:underline">
								{q.workshopCode}
							</a>
						</Table.Cell>
						<Table.Cell class="text-sm">
							{q.prompt}
							{#if q.answer}
								<div class="text-muted-foreground mt-1 line-clamp-2 border-l-2 pl-2 text-xs">
									{q.answer}
								</div>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<form
								method="POST"
								action="?/setStatus"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
										await invalidateAll();
									};
								}}
							>
								<input type="hidden" name="id" value={q.id} />
								<select
									name="status"
									value={q.status}
									onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
									class="border-input bg-background h-7 rounded-md border px-2 text-xs"
								>
									<option value="open">open</option>
									<option value="answered">answered</option>
									<option value="deferred">deferred</option>
								</select>
							</form>
						</Table.Cell>
						<Table.Cell>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
								onclick={() => (editingId = q.id)}
								aria-label="Edit"
							>
								<Pencil class="size-3.5" />
							</button>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

{#if editingId != null}
	{@const q = data.questions.find((x) => x.id === editingId)}
	{#if q}
		<Dialog.Root
			open={true}
			onOpenChange={(v) => {
				if (!v) editingId = null;
			}}
		>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>
						Edit question · <span class="font-mono text-xs">{q.workshopCode}</span>
					</Dialog.Title>
				</Dialog.Header>
				<form
					method="POST"
					action="?/update"
					class="space-y-4"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							editingId = null;
							await invalidateAll();
						};
					}}
				>
					<input type="hidden" name="id" value={q.id} />
					<div class="space-y-2">
						<Label for="q-prompt">Prompt</Label>
						<Textarea id="q-prompt" name="prompt" rows={3} value={q.prompt} required />
					</div>
					<div class="space-y-2">
						<Label for="q-answer">Answer</Label>
						<Textarea id="q-answer" name="answer" rows={5} value={q.answer ?? ''} />
					</div>
					<div class="space-y-2">
						<Label for="q-status">Status</Label>
						<select
							id="q-status"
							name="status"
							value={q.status}
							class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
						>
							<option value="open">Open</option>
							<option value="answered">Answered</option>
							<option value="deferred">Deferred</option>
						</select>
					</div>
					<Dialog.Footer>
						<Button variant="outline" type="button" onclick={() => (editingId = null)}>
							Cancel
						</Button>
						<Button type="submit">Save</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	{/if}
{/if}
