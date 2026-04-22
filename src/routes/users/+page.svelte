<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Copy from '@lucide/svelte/icons/copy';
	import Plus from '@lucide/svelte/icons/plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	let { data } = $props();

	let createOpen = $state(false);
	let latestInvite = $state<{ url: string } | null>(null);
	let copied = $state(false);

	const fmt = (d: string | Date | null) =>
		d
			? new Date(d).toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				})
			: '—';

	const inviteUrl = (code: string) => `${window.location.origin}/signup?invite=${code}`;

	const inviteStatus = (inv: (typeof data.invites)[number]) => {
		if (inv.usedAt) return { label: 'used', variant: 'secondary' as const };
		if (inv.expiresAt && new Date(inv.expiresAt) < new Date())
			return { label: 'expired', variant: 'outline' as const };
		return { label: 'active', variant: 'default' as const };
	};

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="max-w-7xl px-8 py-8">
	<header class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Users & invites</h1>
			<p class="text-muted-foreground text-sm">{data.users.length} users · {data.invites.length} invites</p>
		</div>
		<Button size="sm" class="gap-1" onclick={() => (createOpen = true)}>
			<Plus class="size-4" /> Create invite
		</Button>
	</header>

	<Card.Root class="mb-6">
		<Card.Header>
			<Card.Title class="text-base">Users</Card.Title>
		</Card.Header>
		<Card.Content class="px-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head class="w-24">Role</Table.Head>
						<Table.Head class="w-20">Sessions</Table.Head>
						<Table.Head class="w-28">Created</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.users as u (u.id)}
						<Table.Row class="group">
							<Table.Cell class="font-medium">
								{u.name}
								{#if u.id === data.currentUserId}
									<Badge variant="outline" class="ml-2 text-xs">you</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">{u.email}</Table.Cell>
							<Table.Cell>
								{#if u.id !== data.currentUserId}
									<form
										method="POST"
										action="?/setRole"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												await invalidateAll();
											};
										}}
									>
										<input type="hidden" name="id" value={u.id} />
										<select
											name="role"
											value={u.role}
											onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
											class="border-input bg-background h-7 rounded-md border px-2 text-xs"
										>
											<option value="admin">admin</option>
											<option value="user">user</option>
										</select>
									</form>
								{:else}
									<Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell class="font-mono text-xs">{u.sessions}</Table.Cell>
							<Table.Cell class="text-muted-foreground text-xs">{fmt(u.createdAt)}</Table.Cell>
							<Table.Cell>
								{#if u.id !== data.currentUserId}
									<form
										method="POST"
										action="?/delete"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												await invalidateAll();
											};
										}}
										onsubmit={(e) => {
											if (!confirm(`Delete ${u.name}?`)) e.preventDefault();
										}}
									>
										<input type="hidden" name="id" value={u.id} />
										<button
											type="submit"
											class="{buttonVariants({
												variant: 'ghost',
												size: 'sm'
											})} text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
											aria-label="Delete user"
										>
											<Trash2 class="size-3.5" />
										</button>
									</form>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">Invites</Card.Title>
			<Card.Description>Share these links so others can sign up.</Card.Description>
		</Card.Header>
		<Card.Content class="px-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-20">Status</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head>Code</Table.Head>
						<Table.Head class="w-28">Expires</Table.Head>
						<Table.Head class="w-28">Used by</Table.Head>
						<Table.Head class="w-24 text-right"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.invites as inv (inv.id)}
						{@const s = inviteStatus(inv)}
						<Table.Row class="group">
							<Table.Cell><Badge variant={s.variant}>{s.label}</Badge></Table.Cell>
							<Table.Cell class="text-muted-foreground text-sm">{inv.email ?? 'any'}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{inv.code.slice(0, 12)}…</Table.Cell>
							<Table.Cell class="text-muted-foreground text-xs">{fmt(inv.expiresAt)}</Table.Cell>
							<Table.Cell class="text-muted-foreground text-xs">{inv.usedByName ?? '—'}</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
									{#if !inv.usedAt}
										<button
											type="button"
											class="{buttonVariants({
												variant: 'ghost',
												size: 'sm'
											})} text-muted-foreground hover:text-foreground"
											onclick={() => copy(inviteUrl(inv.code))}
											aria-label="Copy invite link"
										>
											<Copy class="size-3.5" />
										</button>
									{/if}
									<form
										method="POST"
										action="?/deleteInvite"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												await invalidateAll();
											};
										}}
									>
										<input type="hidden" name="id" value={inv.id} />
										<button
											type="submit"
											class="{buttonVariants({
												variant: 'ghost',
												size: 'sm'
											})} text-muted-foreground hover:text-destructive"
											aria-label="Delete invite"
										>
											<Trash2 class="size-3.5" />
										</button>
									</form>
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="text-muted-foreground text-center text-sm py-6">
								No invites yet.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	{#if copied}
		<div class="bg-foreground text-background fixed bottom-4 right-4 rounded-md px-3 py-2 text-xs shadow-lg">
			Copied!
		</div>
	{/if}
</div>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Create invite</Dialog.Title>
			<Dialog.Description>
				Generate a link someone can use to sign up.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/createInvite"
			class="space-y-4"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success' && result.data?.inviteUrl) {
						latestInvite = { url: result.data.inviteUrl as string };
					}
					await invalidateAll();
				};
			}}
		>
			<div class="space-y-2">
				<Label for="inv-email">Email (optional)</Label>
				<Input id="inv-email" name="email" type="email" placeholder="name@example.com" />
				<p class="text-muted-foreground text-xs">
					If set, only this email can use the invite.
				</p>
			</div>
			<div class="space-y-2">
				<Label for="inv-ttl">Expires in (days)</Label>
				<Input id="inv-ttl" name="ttlDays" type="number" min="1" max="90" value="7" />
			</div>

			{#if latestInvite}
				<div class="space-y-2 rounded-md border p-3">
					<Label>Invite link</Label>
					<div class="flex items-center gap-2">
						<Input readonly value={latestInvite.url} class="font-mono text-xs" />
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => copy(latestInvite!.url)}
							class="shrink-0 gap-1"
						>
							<Copy class="size-3.5" /> Copy
						</Button>
					</div>
				</div>
			{/if}

			<Dialog.Footer>
				<Button
					variant="outline"
					type="button"
					onclick={() => {
						createOpen = false;
						latestInvite = null;
					}}
				>
					{latestInvite ? 'Done' : 'Cancel'}
				</Button>
				<Button type="submit">Generate</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
