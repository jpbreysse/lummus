<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Users from '@lucide/svelte/icons/users';
	import Clock from '@lucide/svelte/icons/clock';
	import MessageCircleQuestion from '@lucide/svelte/icons/message-circle-question';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Circle from '@lucide/svelte/icons/circle';

	let { data } = $props();

	const statusIcon = (s: string) =>
		s === 'completed' ? CircleCheck : s === 'in_progress' ? CircleDot : Circle;
	const statusColor = (s: string) =>
		s === 'completed'
			? 'text-emerald-600'
			: s === 'in_progress'
				? 'text-amber-600'
				: 'text-muted-foreground';
	const statusLabel = (s: string) => s.replace('_', ' ');
</script>

<div class="mx-auto max-w-5xl px-6 py-8">
	<header class="mb-6">
		<h1 class="text-2xl font-semibold tracking-tight">Workshops</h1>
		<p class="text-muted-foreground text-sm">
			{data.workshops.length} sessions in the Phase 2 programme
		</p>
	</header>

	<div class="grid gap-4 md:grid-cols-2">
		{#each data.workshops as w (w.id)}
			{@const pct = w.total ? Math.round((w.answered / w.total) * 100) : 0}
			{@const Icon = statusIcon(w.status)}
			<a href="/workshops/{w.code}" class="group block">
				<Card.Root class="hover:border-foreground/20 h-full transition-colors">
					<Card.Header>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<div class="text-muted-foreground flex items-center gap-2 font-mono text-xs">
									<Calendar class="size-3" />
									{w.code} · Week {w.weekNumber} · {w.sessionDurationMinutes}min
								</div>
								<Card.Title class="text-base group-hover:underline">{w.title}</Card.Title>
							</div>
							<Badge variant="outline" class="gap-1 shrink-0">
								<Icon class="size-3 {statusColor(w.status)}" />
								{statusLabel(w.status)}
							</Badge>
						</div>
					</Card.Header>
					<Card.Content>
						<p class="text-muted-foreground mb-4 line-clamp-2 text-sm">{w.description}</p>
						<Progress value={pct} class="h-1.5" />
						<div class="text-muted-foreground mt-2 flex items-center justify-between text-xs">
							<span class="flex items-center gap-1">
								<MessageCircleQuestion class="size-3" />
								{w.answered}/{w.total}
							</span>
							<div class="flex gap-3">
								<span class="flex items-center gap-1"><Users class="size-3" />{w.participants}</span>
								<span class="flex items-center gap-1"><Clock class="size-3" />{Number(w.hours)}h</span>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</a>
		{/each}
	</div>
</div>
