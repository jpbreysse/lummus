<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Pin from '@lucide/svelte/icons/pin';

	let { data } = $props();

	let createOpen = $state(false);
	let editingId = $state<number | null>(null);

	const fmt = (d: string | Date) =>
		new Date(d).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
</script>

<div class="mx-auto max-w-3xl px-6 py-8">
	<header class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Announcements</h1>
			<p class="text-muted-foreground text-sm">
				{data.announcements.length} posts
			</p>
		</div>
		<Button size="sm" class="gap-1" onclick={() => (createOpen = true)}>
			<Plus class="size-4" /> New post
		</Button>
	</header>

	<div class="space-y-3">
		{#each data.announcements as a (a.id)}
			<Card.Root class={a.pinned ? 'border-amber-300' : ''}>
				<Card.Header class="pb-2">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								{#if a.pinned}
									<Pin class="size-3.5 shrink-0 text-amber-600" />
								{/if}
								<Card.Title class="text-base">{a.title}</Card.Title>
							</div>
							<div class="text-muted-foreground mt-0.5 text-xs">
								{a.authorName ?? 'Unknown'} · {fmt(a.createdAt)}
							</div>
						</div>
						<div class="flex gap-1">
							<button
								type="button"
								class="{buttonVariants({
									variant: 'ghost',
									size: 'sm'
								})} text-muted-foreground hover:text-foreground"
								onclick={() => (editingId = a.id)}
								aria-label="Edit"
							>
								<Pencil class="size-3.5" />
							</button>
						</div>
					</div>
				</Card.Header>
				<Card.Content>
					<p class="text-sm whitespace-pre-wrap">{a.body}</p>
				</Card.Content>
			</Card.Root>
		{:else}
			<p class="text-muted-foreground py-12 text-center text-sm">
				No announcements yet. Share the next meeting time or any update for the team.
			</p>
		{/each}
	</div>
</div>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New announcement</Dialog.Title>
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
				<Label for="a-title">Title</Label>
				<Input id="a-title" name="title" required />
			</div>
			<div class="space-y-2">
				<Label for="a-body">Message</Label>
				<Textarea id="a-body" name="body" rows={5} required />
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" name="pinned" class="h-4 w-4" />
				Pin to top
			</label>
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (createOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Post</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

{#if editingId != null}
	{@const a = data.announcements.find((x) => x.id === editingId)}
	{#if a}
		<Dialog.Root
			open={true}
			onOpenChange={(v) => {
				if (!v) editingId = null;
			}}
		>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Edit announcement</Dialog.Title>
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
					<input type="hidden" name="id" value={a.id} />
					<div class="space-y-2">
						<Label for="e-title">Title</Label>
						<Input id="e-title" name="title" value={a.title} required />
					</div>
					<div class="space-y-2">
						<Label for="e-body">Message</Label>
						<Textarea id="e-body" name="body" rows={5} value={a.body} required />
					</div>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" name="pinned" checked={a.pinned} class="h-4 w-4" />
						Pin to top
					</label>
					<Dialog.Footer class="justify-between">
						<button
							type="submit"
							formaction="?/delete"
							class="{buttonVariants({
								variant: 'ghost',
								size: 'sm'
							})} text-destructive"
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
