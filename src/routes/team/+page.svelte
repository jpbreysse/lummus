<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let { data } = $props();

	let addOpen = $state(false);
	let editingId = $state<number | null>(null);
</script>

<div class="mx-auto max-w-5xl px-6 py-8">
	<header class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Team</h1>
			<p class="text-muted-foreground text-sm">{data.members.length} participants</p>
		</div>
		<Button size="sm" class="gap-1" onclick={() => (addOpen = true)}>
			<Plus class="size-4" /> Add member
		</Button>
	</header>

	<div class="rounded-lg border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Role</Table.Head>
					<Table.Head>Org</Table.Head>
					<Table.Head>Workshops</Table.Head>
					<Table.Head class="w-16"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.members as m (m.id)}
					<Table.Row class="group">
						<Table.Cell class="font-medium">{m.name}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{m.role ?? '—'}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{m.organization ?? '—'}</Table.Cell>
						<Table.Cell>
							<div class="flex gap-1">
								{#each m.workshops as code (code)}
									<Badge variant="outline" class="font-mono text-xs">{code}</Badge>
								{/each}
							</div>
						</Table.Cell>
						<Table.Cell>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
								onclick={() => (editingId = m.id)}
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

<Dialog.Root bind:open={addOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add member</Dialog.Title>
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
			<div class="space-y-2">
				<Label for="m-name">Name</Label>
				<Input id="m-name" name="name" required />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<Label for="m-role">Role</Label>
					<Input id="m-role" name="role" />
				</div>
				<div class="space-y-2">
					<Label for="m-org">Organization</Label>
					<Input id="m-org" name="organization" />
				</div>
			</div>
			<div class="space-y-2">
				<Label for="m-email">Email</Label>
				<Input id="m-email" name="email" type="email" />
			</div>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (addOpen = false)}>Cancel</Button>
				<Button type="submit">Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

{#if editingId != null}
	{@const m = data.members.find((x) => x.id === editingId)}
	{#if m}
		<Dialog.Root
			open={true}
			onOpenChange={(v) => {
				if (!v) editingId = null;
			}}
		>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Edit member</Dialog.Title>
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
					<input type="hidden" name="id" value={m.id} />
					<div class="space-y-2">
						<Label for="e-name">Name</Label>
						<Input id="e-name" name="name" value={m.name} required />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-2">
							<Label for="e-role">Role</Label>
							<Input id="e-role" name="role" value={m.role ?? ''} />
						</div>
						<div class="space-y-2">
							<Label for="e-org">Organization</Label>
							<Input id="e-org" name="organization" value={m.organization ?? ''} />
						</div>
					</div>
					<div class="space-y-2">
						<Label for="e-email">Email</Label>
						<Input id="e-email" name="email" type="email" value={m.email ?? ''} />
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
