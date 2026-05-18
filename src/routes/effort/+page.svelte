<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Clock from '@lucide/svelte/icons/clock';

	let { data } = $props();

	let addOpen = $state(false);
	let editingId = $state<number | null>(null);

	const fmtDate = (d: string | Date) =>
		new Date(d).toLocaleDateString(undefined, {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});

	const toInput = (d: string | Date) => {
		const dt = new Date(d);
		return dt.toISOString().slice(0, 10);
	};

	const today = new Date().toISOString().slice(0, 10);
</script>

<div class="max-w-7xl px-8 py-8">
	<header class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
				<Clock class="size-5" /> Effort tracker
			</h1>
			<p class="text-muted-foreground text-sm">
				Admin-only log of internal effort that isn't tied to a workshop. {data.entries.length}
				entries · {data.total}h total.
			</p>
		</div>
		<Button size="sm" class="gap-1" onclick={() => (addOpen = true)}>
			<Plus class="size-4" /> Log effort
		</Button>
	</header>

	<div class="rounded-lg border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-32">Date</Table.Head>
					<Table.Head class="w-40">Person</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head class="w-20 text-right">Hours</Table.Head>
					<Table.Head class="w-12"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.entries as e (e.id)}
					<Table.Row class="group">
						<Table.Cell class="text-muted-foreground text-xs">{fmtDate(e.date)}</Table.Cell>
						<Table.Cell class="text-muted-foreground text-sm">{e.userName ?? '—'}</Table.Cell>
						<Table.Cell class="text-sm">{e.description}</Table.Cell>
						<Table.Cell class="text-right font-mono tabular-nums">{e.hours}</Table.Cell>
						<Table.Cell>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
								onclick={() => (editingId = e.id)}
								aria-label="Edit"
							>
								<Pencil class="size-3.5" />
							</button>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="text-muted-foreground text-center py-8 text-sm">
							No effort logged yet.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<!-- Create dialog -->
<Dialog.Root bind:open={addOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Log effort</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			class="space-y-4"
			use:enhance={() => {
				return async ({ update, formElement }) => {
					await update();
					formElement.reset();
					addOpen = false;
					await invalidateAll();
				};
			}}
		>
			<div class="grid grid-cols-[1fr_auto] gap-3">
				<div class="space-y-2">
					<Label for="e-date">Date</Label>
					<Input id="e-date" name="date" type="date" value={today} required />
				</div>
				<div class="space-y-2">
					<Label for="e-hours">Hours</Label>
					<Input id="e-hours" name="hours" type="number" step="0.25" min="0" class="w-24" required />
				</div>
			</div>
			<div class="space-y-2">
				<Label for="e-user">Person (optional)</Label>
				<select
					id="e-user"
					name="userId"
					class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
				>
					<option value="">(unattributed)</option>
					{#each data.users as u (u.id)}
						<option value={u.id}>{u.name}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				<Label for="e-desc">Description</Label>
				<Textarea
					id="e-desc"
					name="description"
					rows={3}
					required
					placeholder="What was the work?"
				/>
			</div>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (addOpen = false)}>Cancel</Button>
				<Button type="submit">Log</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

{#if editingId != null}
	{@const e = data.entries.find((x) => x.id === editingId)}
	{#if e}
		<Dialog.Root
			open={true}
			onOpenChange={(v) => {
				if (!v) editingId = null;
			}}
		>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Edit effort entry</Dialog.Title>
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
					<input type="hidden" name="id" value={e.id} />
					<div class="grid grid-cols-[1fr_auto] gap-3">
						<div class="space-y-2">
							<Label for="u-date">Date</Label>
							<Input id="u-date" name="date" type="date" value={toInput(e.date)} required />
						</div>
						<div class="space-y-2">
							<Label for="u-hours">Hours</Label>
							<Input
								id="u-hours"
								name="hours"
								type="number"
								step="0.25"
								min="0"
								class="w-24"
								value={e.hours}
								required
							/>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="u-user">Person</Label>
						<select
							id="u-user"
							name="userId"
							class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
						>
							<option value="">(unattributed)</option>
							{#each data.users as u (u.id)}
								<option value={u.id} selected={u.id === e.userId}>{u.name}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="u-desc">Description</Label>
						<Textarea id="u-desc" name="description" rows={3} value={e.description} required />
					</div>
					<Dialog.Footer class="justify-between">
						<button
							type="submit"
							formaction="?/delete"
							class="{buttonVariants({ variant: 'ghost', size: 'sm' })} text-destructive"
						>
							<Trash2 class="mr-1 size-3.5" /> Delete
						</button>
						<div class="flex gap-2">
							<Button variant="outline" type="button" onclick={() => (editingId = null)}>
								Cancel
							</Button>
							<Button type="submit">Save</Button>
						</div>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	{/if}
{/if}
