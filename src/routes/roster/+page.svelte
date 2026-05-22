<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import Send from '@lucide/svelte/icons/send';
	import Copy from '@lucide/svelte/icons/copy';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let { data } = $props();

	type Filter = 'all' | 'pending' | 'registered';
	let filter = $state<Filter>('all');

	let importing = $state(false);
	let importMessage = $state<string | null>(null);
	let importError = $state<string | null>(null);
	let warnings = $state<string[]>([]);

	let lastInviteUrl = $state<string | null>(null);
	let copied = $state(false);

	const filteredEntries = $derived(
		filter === 'all'
			? data.entries
			: data.entries.filter((e) => (filter === 'pending' ? !e.registered : e.registered))
	);

	async function copyToClipboard(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const fmtCodes = (codes: string[] | null) => (codes && codes.length ? codes.join(', ') : '—');

	const inviteUrlFor = (code: string) => `${window.location.origin}/signup?invite=${code}`;
</script>

<div class="max-w-7xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-2xl font-semibold tracking-tight">Roster</h1>
		<p class="text-muted-foreground mt-1 text-sm">
			Compare the upstream list of expected users with the actual registrations.
		</p>
	</header>

	<!-- Counts -->
	<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>In roster</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{data.counts.total}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Registered</Card.Description>
				<Card.Title class="text-3xl tabular-nums text-emerald-700">{data.counts.registered}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Pending</Card.Description>
				<Card.Title class="text-3xl tabular-nums text-amber-700">{data.counts.pending}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Extras (registered, not in roster)</Card.Description>
				<Card.Title class="text-3xl tabular-nums">{data.counts.extras}</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	<!-- Import card -->
	<Card.Root class="mb-6">
		<Card.Header>
			<Card.Title class="text-base">Import roster</Card.Title>
			<Card.Description>
				Upload the upstream Excel ("workstream assignments" sheet, columns B–H). Re-imports are
				idempotent — rows are upserted on email.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				action="?/import"
				enctype="multipart/form-data"
				class="flex flex-wrap items-end gap-3"
				use:enhance={() => {
					importing = true;
					importError = null;
					importMessage = null;
					warnings = [];
					return async ({ result }) => {
						importing = false;
						if (result.type === 'success' && result.data) {
							const d = result.data as { imported?: number; warnings?: string[] };
							importMessage = `Imported ${d.imported} rows.`;
							warnings = d.warnings ?? [];
						} else if (result.type === 'failure' && result.data) {
							importError = String((result.data as { error?: string }).error ?? 'Failed');
						}
						await invalidateAll();
					};
				}}
			>
				<div class="space-y-2">
					<Label for="roster-file">File (.xlsx)</Label>
					<Input id="roster-file" name="file" type="file" accept=".xlsx" required />
				</div>
				<Button type="submit" disabled={importing} class="gap-1">
					<Upload class="size-4" />
					{importing ? 'Importing…' : 'Import'}
				</Button>
			</form>
			<form
				method="POST"
				action="?/clearAll"
				class="mt-3 inline-block"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						await invalidateAll();
					};
				}}
				onsubmit={(e) => {
					if (!confirm('Clear ALL roster entries? Registrations are NOT touched.'))
						e.preventDefault();
				}}
			>
				<Button type="submit" variant="outline" size="sm" class="gap-1 text-destructive">
					<Trash2 class="size-3.5" /> Clear roster
				</Button>
			</form>

			{#if importMessage}
				<p class="mt-3 flex items-center gap-1 text-sm text-emerald-700">
					<CircleCheck class="size-4" /> {importMessage}
				</p>
			{/if}
			{#if importError}
				<p class="mt-3 flex items-center gap-1 text-sm text-destructive">
					<CircleAlert class="size-4" /> {importError}
				</p>
			{/if}
			{#if warnings.length}
				<details class="mt-3 text-xs">
					<summary class="text-amber-700 cursor-pointer">{warnings.length} warning(s)</summary>
					<ul class="mt-2 list-disc pl-6 text-muted-foreground">
						{#each warnings as w (w)}
							<li>{w}</li>
						{/each}
					</ul>
				</details>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Roster table -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title class="text-base">Entries ({filteredEntries.length})</Card.Title>
				<div class="flex gap-1 text-sm">
					{#each [['all', 'All'], ['pending', 'Pending'], ['registered', 'Registered']] as const as [k, label] (k)}
						<button
							type="button"
							class="hover:bg-accent rounded-md border px-2.5 py-1 text-xs transition-colors {filter ===
							k
								? 'bg-accent font-medium'
								: 'text-muted-foreground'}"
							onclick={() => (filter = k)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>
		</Card.Header>
		<Card.Content class="px-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-32">Status</Table.Head>
						<Table.Head>Name</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head class="w-24">Role</Table.Head>
						<Table.Head class="w-40">Workshops</Table.Head>
						<Table.Head class="w-48 text-right"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredEntries as e (e.id)}
						<Table.Row class="group">
							<Table.Cell>
								{#if e.registered}
									<Badge variant="default" class="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
										<CircleCheck class="size-3" /> registered
									</Badge>
								{:else if e.openInviteCode}
									<Badge variant="outline" class="gap-1 border-amber-300 text-amber-700">
										invited
									</Badge>
								{:else}
									<Badge variant="outline" class="text-muted-foreground">pending</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell class="font-medium">{e.name}</Table.Cell>
							<Table.Cell class="text-muted-foreground text-sm">{e.email}</Table.Cell>
							<Table.Cell>
								{#if e.workshopRole}
									<Badge variant="outline" class="text-[10px]">{e.workshopRole}</Badge>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
								{#if e.registered && e.matchedRole && e.matchedRole !== e.workshopRole}
									<div class="text-xs text-amber-700 mt-0.5">
										app: {e.matchedRole ?? '—'}
									</div>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if e.workshopCodes && e.workshopCodes.length}
									<div class="flex flex-wrap gap-1">
										{#each e.workshopCodes as c (c)}
											<Badge variant="outline" class="font-mono text-[10px]">{c}</Badge>
										{/each}
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
									{#if e.openInviteCode}
										<button
											type="button"
											class="{buttonVariants({ variant: 'ghost', size: 'sm' })} gap-1 text-muted-foreground hover:text-foreground"
											onclick={() => copyToClipboard(inviteUrlFor(e.openInviteCode!))}
											aria-label="Copy existing invite link"
										>
											<Copy class="size-3.5" /> Copy link
										</button>
									{:else if !e.registered}
										<form
											method="POST"
											action="?/createInviteForEntry"
											use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success' && result.data) {
														const d = result.data as { inviteUrl?: string };
														if (d.inviteUrl) {
															lastInviteUrl = d.inviteUrl;
															await copyToClipboard(d.inviteUrl);
														}
													}
													await invalidateAll();
												};
											}}
										>
											<input type="hidden" name="id" value={e.id} />
											<button
												type="submit"
												class="{buttonVariants({ variant: 'ghost', size: 'sm' })} gap-1 text-muted-foreground hover:text-foreground"
												aria-label="Create invite"
											>
												<Send class="size-3.5" /> Send invite
											</button>
										</form>
									{/if}
									<form
										method="POST"
										action="?/deleteEntry"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
												await invalidateAll();
											};
										}}
										onsubmit={(e2) => {
											if (!confirm(`Remove ${e.name} from roster?`)) e2.preventDefault();
										}}
									>
										<input type="hidden" name="id" value={e.id} />
										<button
											type="submit"
											class="{buttonVariants({ variant: 'ghost', size: 'sm' })} text-muted-foreground hover:text-destructive"
											aria-label="Remove from roster"
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
								{data.counts.total === 0
									? 'No roster yet. Import an Excel above.'
									: 'No entries match this filter.'}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Extras -->
	{#if data.extras.length}
		<Card.Root class="mt-6">
			<Card.Header>
				<Card.Title class="text-base">Extras ({data.extras.length})</Card.Title>
				<Card.Description>
					Registered users whose email is not in the roster. Admins are excluded.
				</Card.Description>
			</Card.Header>
			<Card.Content class="px-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head>Email</Table.Head>
							<Table.Head class="w-24">Role</Table.Head>
							<Table.Head class="w-24">Workshop role</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.extras as u (u.id)}
							<Table.Row>
								<Table.Cell class="font-medium">{u.name}</Table.Cell>
								<Table.Cell class="text-muted-foreground text-sm">{u.email}</Table.Cell>
								<Table.Cell><Badge variant="secondary">{u.role}</Badge></Table.Cell>
								<Table.Cell>
									{#if u.workshopRole}
										<Badge variant="outline" class="text-[10px]">{u.workshopRole}</Badge>
									{:else}
										<span class="text-muted-foreground text-xs">—</span>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if lastInviteUrl}
		<div class="bg-foreground text-background fixed bottom-4 right-4 max-w-md rounded-md px-4 py-3 text-xs shadow-lg">
			<div class="mb-1 font-medium">Invite created — link copied to clipboard</div>
			<div class="text-muted-foreground truncate font-mono">{lastInviteUrl}</div>
		</div>
	{/if}
	{#if copied}
		<div class="bg-foreground text-background fixed bottom-4 left-4 rounded-md px-3 py-2 text-xs shadow-lg">
			Copied!
		</div>
	{/if}
</div>
