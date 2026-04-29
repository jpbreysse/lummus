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
	import FileDown from '@lucide/svelte/icons/file-down';
	import Plus from '@lucide/svelte/icons/plus';

	let { data } = $props();
	const isAdmin = $derived(data.isAdmin);
	let editingId = $state<number | null>(null);
	let createOpen = $state(false);

	type Status = 'open' | 'answered' | 'deferred';
	let filter = $state<'all' | Status>('all');
	let workshopFilter = $state<string>('all');

	const workshopCodes = $derived(
		Array.from(new Set(data.questions.map((q) => q.workshopCode))).sort()
	);

	const filtered = $derived(
		data.questions.filter(
			(q) =>
				(filter === 'all' || q.status === filter) &&
				(workshopFilter === 'all' || q.workshopCode === workshopFilter)
		)
	);

	const countsForFilter = (base: typeof data.questions) => ({
		all: base.length,
		open: base.filter((q) => q.status === 'open').length,
		answered: base.filter((q) => q.status === 'answered').length,
		deferred: base.filter((q) => q.status === 'deferred').length
	});
	const counts = $derived(
		countsForFilter(
			workshopFilter === 'all'
				? data.questions
				: data.questions.filter((q) => q.workshopCode === workshopFilter)
		)
	);

	const workshopCount = (code: string) =>
		data.questions.filter((q) => q.workshopCode === code).length;

	const statusVariant = (s: string) =>
		s === 'answered' ? 'default' : s === 'deferred' ? 'secondary' : 'outline';
</script>

<div class="max-w-7xl px-8 py-8">
	<header class="mb-4 flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Questions</h1>
			<p class="text-muted-foreground text-sm">Across all workshops</p>
		</div>
		{#if isAdmin}
			<div class="flex gap-2">
				<Button size="sm" class="gap-1" onclick={() => (createOpen = true)}>
					<Plus class="size-4" /> Add question
				</Button>
				<Button href="/questions/export" variant="outline" size="sm" class="gap-1">
					<FileDown class="size-4" /> Export Excel
				</Button>
			</div>
		{/if}
	</header>

	<div class="mb-4 flex flex-wrap items-center gap-4">
		<div class="flex gap-1 text-sm">
			<span class="text-muted-foreground self-center text-xs">Workshop:</span>
			<button
				type="button"
				class="hover:bg-accent rounded-md border px-3 py-1 text-xs transition-colors {workshopFilter ===
				'all'
					? 'bg-accent font-medium'
					: 'text-muted-foreground'}"
				onclick={() => (workshopFilter = 'all')}
			>
				All <span class="ml-1 opacity-60">{data.questions.length}</span>
			</button>
			{#each workshopCodes as code (code)}
				<button
					type="button"
					class="hover:bg-accent rounded-md border px-3 py-1 font-mono text-xs transition-colors {workshopFilter ===
					code
						? 'bg-accent font-medium'
						: 'text-muted-foreground'}"
					onclick={() => (workshopFilter = code)}
				>
					{code} <span class="ml-1 opacity-60">{workshopCount(code)}</span>
				</button>
			{/each}
		</div>

		<div class="flex gap-1 text-sm">
			<span class="text-muted-foreground self-center text-xs">Status:</span>
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
							{#if isAdmin && q.answer}
								<div class="text-muted-foreground mt-1 line-clamp-2 border-l-2 border-emerald-500 pl-2 text-xs">
									<span class="text-emerald-700 font-medium">Official — </span>{q.answer}
								</div>
							{/if}
							{#if q.ownResponse}
								<div class="text-muted-foreground mt-1 line-clamp-2 border-l-2 pl-2 text-xs">
									<span class="text-foreground font-medium">Your response — </span>{q.ownResponse}
								</div>
							{/if}
						</Table.Cell>
						<Table.Cell>
							{#if isAdmin}
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
							{:else}
								<Badge variant={statusVariant(q.status)}>{q.status}</Badge>
							{/if}
						</Table.Cell>
						<Table.Cell>
							{#if isAdmin}
								<button
									type="button"
									class="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
									onclick={() => (editingId = q.id)}
									aria-label="Edit"
								>
									<Pencil class="size-3.5" />
								</button>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add question</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			class="space-y-4"
			use:enhance={() => {
				return async ({ update, formElement }) => {
					await update();
					formElement.reset();
					createOpen = false;
					await invalidateAll();
				};
			}}
		>
			<div class="space-y-2">
				<Label for="c-workshop">Workshop</Label>
				<select
					id="c-workshop"
					name="workshopId"
					required
					class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
				>
					<option value="" disabled selected>Choose workshop…</option>
					{#each data.workshops as w (w.id)}
						<option value={w.id}>{w.code} — {w.title}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				<Label for="c-prompt">Prompt</Label>
				<Textarea id="c-prompt" name="prompt" rows={3} required />
			</div>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (createOpen = false)}>
					Cancel
				</Button>
				<Button type="submit" class="gap-1"><Plus class="size-3.5" /> Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

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
