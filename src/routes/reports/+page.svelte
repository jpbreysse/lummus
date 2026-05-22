<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import VenetianMask from '@lucide/svelte/icons/venetian-mask';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import MessageCirclePlus from '@lucide/svelte/icons/message-circle-plus';

	let { data } = $props();

	// Heat colour for a cell: number → emerald shade
	const heat = (n: number) => {
		if (n === 0) return '';
		if (n === 1) return 'bg-emerald-50 dark:bg-emerald-950/30';
		if (n <= 3) return 'bg-emerald-100 dark:bg-emerald-900/40';
		if (n <= 6) return 'bg-emerald-200 dark:bg-emerald-800/50';
		return 'bg-emerald-300 dark:bg-emerald-700/60';
	};

	const rate = (responses: number, questions: number, members: number) => {
		const denom = questions * members;
		if (!denom) return 0;
		return Math.round((responses / denom) * 100);
	};
</script>

<div class="max-w-7xl px-8 py-8">
	<header class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Reports — Participation matrix</h1>
			<p class="text-muted-foreground text-sm">
				Per-user counts of named responses and comments across each workshop.
				Anonymous responses are aggregated separately (no attribution).
			</p>
		</div>
		<a
			href="/reports/pipeline"
			class="hover:bg-accent text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors"
		>
			Pipeline report →
		</a>
	</header>

	<div class="overflow-x-auto rounded-lg border">
		<table class="w-full text-sm">
			<thead class="bg-muted/30 text-muted-foreground">
				<tr>
					<th class="sticky left-0 z-10 bg-muted/30 px-4 py-2 text-left text-xs font-medium">User</th>
					{#each data.workshops as w (w.id)}
						<th class="px-3 py-2 text-center text-xs font-medium">
							<div class="font-mono">{w.code}</div>
							<div class="text-muted-foreground truncate text-[10px]">{w.title}</div>
						</th>
					{/each}
					<th class="px-3 py-2 text-center text-xs font-medium">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each data.matrix as row (row.user.id)}
					<tr class="border-t">
						<td class="sticky left-0 z-10 bg-background px-4 py-2">
							<div class="flex items-center gap-2">
								<span class="font-medium">{row.user.name}</span>
								{#if row.user.role === 'admin'}
									<Badge variant="outline" class="text-[10px]">admin</Badge>
								{/if}
							</div>
							<div class="text-muted-foreground text-[11px]">{row.user.email}</div>
						</td>
						{#each row.cells as cell (cell.workshopId)}
							<td class="px-2 py-2 text-center {heat(cell.responses)}">
								<div class="flex items-center justify-center gap-2">
									<span
										class="flex items-center gap-0.5 tabular-nums"
										class:text-muted-foreground={cell.responses === 0}
									>
										<MessageCirclePlus class="size-3" /> {cell.responses}
									</span>
									<span
										class="flex items-center gap-0.5 tabular-nums"
										class:text-muted-foreground={cell.comments === 0}
									>
										<MessageSquare class="size-3" /> {cell.comments}
									</span>
								</div>
							</td>
						{/each}
						<td class="bg-muted/20 px-3 py-2 text-center font-medium tabular-nums">
							{row.totalResponses + row.totalComments}
						</td>
					</tr>
				{/each}
				{#if data.anonTotal > 0}
					<tr class="border-t bg-amber-50/40 dark:bg-amber-950/10">
						<td class="sticky left-0 z-10 bg-amber-50/60 px-4 py-2 dark:bg-amber-950/20">
							<div class="flex items-center gap-2">
								<VenetianMask class="size-3.5 text-amber-700" />
								<span class="font-medium">Anonymous responses</span>
							</div>
							<div class="text-muted-foreground text-[11px]">No attribution</div>
						</td>
						{#each data.anonRow as a (a.workshopId)}
							<td class="px-2 py-2 text-center {heat(a.count)}">
								<span
									class="flex items-center justify-center gap-0.5 tabular-nums"
									class:text-muted-foreground={a.count === 0}
								>
									<VenetianMask class="size-3" /> {a.count}
								</span>
							</td>
						{/each}
						<td class="bg-muted/20 px-3 py-2 text-center font-medium tabular-nums">
							{data.anonTotal}
						</td>
					</tr>
				{/if}
			</tbody>
			<tfoot class="bg-muted/30 text-xs">
				<tr class="border-t">
					<td class="sticky left-0 z-10 bg-muted/30 px-4 py-2 font-medium">
						Totals
						<div class="text-muted-foreground text-[11px]">
							of {data.totalsRow.reduce((s, t) => s + t.questions, 0)} published questions
						</div>
					</td>
					{#each data.totalsRow as t (t.workshopId)}
						{@const ratePct = data.matrix.length && t.questions
							? rate(t.responses, t.questions, data.matrix.length)
							: 0}
						<td class="px-2 py-2 text-center">
							<div class="font-medium tabular-nums">
								{t.responses + t.comments + t.anonymous}
							</div>
							<div class="text-muted-foreground text-[10px]">
								{t.responses}r · {t.comments}c · {t.anonymous}a
							</div>
							<div class="text-muted-foreground text-[10px]">
								{ratePct}% reach
							</div>
						</td>
					{/each}
					<td class="bg-muted/40 px-3 py-2 text-center font-medium tabular-nums">
						{data.totalsRow.reduce((s, t) => s + t.responses + t.comments + t.anonymous, 0)}
					</td>
				</tr>
			</tfoot>
		</table>
	</div>

	<div class="text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-xs">
		<span class="flex items-center gap-1">
			<MessageCirclePlus class="size-3" /> named response
		</span>
		<span class="flex items-center gap-1">
			<MessageSquare class="size-3" /> comment
		</span>
		<span class="flex items-center gap-1">
			<VenetianMask class="size-3" /> anonymous response
		</span>
		<span class="flex items-center gap-1">
			<span class="inline-block size-3 rounded-sm bg-emerald-50 dark:bg-emerald-950/30"></span>
			1
		</span>
		<span class="flex items-center gap-1">
			<span class="inline-block size-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/40"></span>
			2–3
		</span>
		<span class="flex items-center gap-1">
			<span class="inline-block size-3 rounded-sm bg-emerald-200 dark:bg-emerald-800/50"></span>
			4–6
		</span>
		<span class="flex items-center gap-1">
			<span class="inline-block size-3 rounded-sm bg-emerald-300 dark:bg-emerald-700/60"></span>
			7+
		</span>
	</div>
</div>
