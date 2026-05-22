<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Download from '@lucide/svelte/icons/download';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let { data } = $props();

	type Status =
		| 'registered'
		| 'mismatch'
		| 'invited'
		| 'expired'
		| 'action_needed'
		| 'extra'
		| 'orphan_invite';
	type Filter = 'all' | Status;
	let filter = $state<Filter>('all');

	const statusMeta: Record<
		Status,
		{ label: string; tone: string; icon?: typeof CircleCheck }
	> = {
		registered: { label: 'registered', tone: 'bg-emerald-100 text-emerald-800', icon: CircleCheck },
		mismatch: { label: 'role mismatch', tone: 'bg-rose-100 text-rose-800', icon: CircleAlert },
		invited: { label: 'invited', tone: 'bg-amber-100 text-amber-800' },
		expired: { label: 'invite expired', tone: 'bg-orange-100 text-orange-800' },
		action_needed: { label: 'action needed', tone: 'bg-yellow-100 text-yellow-800' },
		extra: { label: 'extra (not in roster)', tone: 'bg-violet-100 text-violet-800' },
		orphan_invite: { label: 'orphan invite', tone: 'bg-slate-100 text-slate-800' }
	};

	const fmt = (d: Date | string | null) =>
		d
			? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
			: '—';

	const filteredRows = $derived(
		filter === 'all' ? data.rows : data.rows.filter((r) => r.status === filter)
	);

	function downloadCsv() {
		const header = [
			'email',
			'name',
			'status',
			'in_roster',
			'roster_role',
			'roster_workshops',
			'user_role',
			'app_workshop_role',
			'invites_total',
			'invites_open',
			'invites_used',
			'invites_expired',
			'role_mismatch',
			'user_created_at'
		];
		const lines = [header.join(',')];
		for (const r of data.rows) {
			const inv = r.invites.reduce(
				(a, i) => {
					a[i.state]++;
					return a;
				},
				{ open: 0, used: 0, expired: 0 } as Record<'open' | 'used' | 'expired', number>
			);
			const escape = (v: unknown) => {
				const s = v == null ? '' : String(v);
				return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
			};
			lines.push(
				[
					r.email,
					r.name,
					r.status,
					r.roster ? 'yes' : 'no',
					r.roster?.workshopRole ?? '',
					(r.roster?.workshopCodes ?? []).join('|'),
					r.user?.role ?? '',
					r.user?.workshopRole ?? '',
					r.invites.length,
					inv.open,
					inv.used,
					inv.expired,
					r.roleMismatch ? 'yes' : 'no',
					r.user?.createdAt ? new Date(r.user.createdAt).toISOString() : ''
				]
					.map(escape)
					.join(',')
			);
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="max-w-7xl px-8 py-8">
	<Button href="/reports" variant="ghost" size="sm" class="mb-4 gap-1">
		<ArrowLeft class="size-4" /> Reports
	</Button>

	<header class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Pipeline report</h1>
			<p class="text-muted-foreground mt-1 text-sm">
				Roster, invitations, and registrations joined on email. Each row is one person; the
				status reflects the worst-case state across the three sources.
			</p>
		</div>
		<Button variant="outline" size="sm" class="gap-1" onclick={downloadCsv}>
			<Download class="size-4" /> Export CSV
		</Button>
	</header>

	<!-- Top counters -->
	<div class="mb-4 grid gap-3 sm:grid-cols-3">
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>In roster</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{data.counts.rosterTotal}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Invites sent</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{data.counts.invitesTotal}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header class="pb-2">
				<Card.Description>Registered users (non-admin)</Card.Description>
				<Card.Title class="text-2xl tabular-nums">{data.counts.usersTotal}</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	<!-- Status filter chips -->
	<div class="mb-4 flex flex-wrap gap-1 text-sm">
		{#each [['all', `All ${data.counts.total}`], ['mismatch', `Role mismatch ${data.counts.mismatch}`], ['action_needed', `Action needed ${data.counts.action_needed}`], ['expired', `Expired ${data.counts.expired}`], ['invited', `Invited ${data.counts.invited}`], ['extra', `Extras ${data.counts.extra}`], ['orphan_invite', `Orphan invites ${data.counts.orphan_invite}`], ['registered', `Registered ${data.counts.registered}`]] as const as [k, label] (k)}
			<button
				type="button"
				class="hover:bg-accent rounded-md border px-2.5 py-1 text-xs transition-colors {filter ===
				k
					? 'bg-accent font-medium'
					: 'text-muted-foreground'}"
				onclick={() => (filter = k as Filter)}
			>
				{label}
			</button>
		{/each}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">{filteredRows.length} row(s)</Card.Title>
		</Card.Header>
		<Card.Content class="px-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-44">Status</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head>Name</Table.Head>
						<Table.Head class="w-44">Roster</Table.Head>
						<Table.Head class="w-44">Invites</Table.Head>
						<Table.Head class="w-44">Registration</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredRows as r (r.email)}
						{@const meta = statusMeta[r.status as Status]}
						<Table.Row>
							<Table.Cell>
								<span class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium {meta.tone}">
									{#if meta.icon}{@const Icon = meta.icon}<Icon class="size-3" />{/if}
									{meta.label}
								</span>
							</Table.Cell>
							<Table.Cell class="text-muted-foreground text-sm">{r.email}</Table.Cell>
							<Table.Cell class="font-medium">{r.name}</Table.Cell>
							<Table.Cell>
								{#if r.roster}
									<div class="flex flex-wrap items-center gap-1">
										{#if r.roster.workshopRole}
											<Badge variant="outline" class="text-[10px]">{r.roster.workshopRole}</Badge>
										{/if}
										{#each r.roster.workshopCodes ?? [] as c (c)}
											<Badge variant="outline" class="font-mono text-[10px]">{c}</Badge>
										{/each}
										{#if !r.roster.workshopRole && !(r.roster.workshopCodes && r.roster.workshopCodes.length)}
											<span class="text-muted-foreground text-xs">empty</span>
										{/if}
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if r.invites.length}
									<div class="space-y-0.5">
										{#each r.invites.slice(0, 3) as inv (inv.id)}
											<div class="flex items-center gap-1 text-[11px]">
												<Badge
													variant="outline"
													class="text-[10px] {inv.state === 'open'
														? 'border-amber-300 text-amber-700'
														: inv.state === 'used'
															? 'border-emerald-300 text-emerald-700'
															: 'border-orange-300 text-orange-700'}"
												>
													{inv.state}
												</Badge>
												<span class="text-muted-foreground">{fmt(inv.createdAt)}</span>
											</div>
										{/each}
										{#if r.invites.length > 3}
											<div class="text-muted-foreground text-[10px]">
												+{r.invites.length - 3} more
											</div>
										{/if}
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if r.user}
									<div class="flex flex-col gap-0.5">
										<div class="flex items-center gap-1">
											<Badge variant="secondary" class="text-[10px]">{r.user.role}</Badge>
											{#if r.user.workshopRole}
												<Badge
													variant="outline"
													class="text-[10px] {r.roleMismatch
														? 'border-rose-400 text-rose-700'
														: ''}"
												>
													{r.user.workshopRole}
												</Badge>
											{/if}
										</div>
										<div class="text-muted-foreground text-[10px]">
											since {fmt(r.user.createdAt)}
										</div>
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="text-muted-foreground text-center text-sm py-6">
								No rows match this filter.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
