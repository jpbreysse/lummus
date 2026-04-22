<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Users from '@lucide/svelte/icons/users';
	import Clock from '@lucide/svelte/icons/clock';
	import MessageCircleQuestion from '@lucide/svelte/icons/message-circle-question';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Circle from '@lucide/svelte/icons/circle';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

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

	const fmtSchedule = (d: string | Date) =>
		new Date(d).toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
</script>

<div class="max-w-7xl px-8 py-8">
	<header class="mb-8">
		<h1 class="text-3xl font-semibold tracking-tight">Workshops</h1>
		<p class="text-muted-foreground mt-1 text-sm">
			{data.workshops.length} sessions in the Phase 2 programme
		</p>
	</header>

	<div class="grid gap-6 lg:grid-cols-2">
		{#each data.workshops as w (w.id)}
			{@const pct = w.total ? Math.round((w.answered / w.total) * 100) : 0}
			{@const Icon = statusIcon(w.status)}
			<a href="/workshops/{w.code}" class="group block">
				<Card.Root class="hover:border-foreground/30 hover:shadow-md flex h-full flex-col transition-all">
					<Card.Header class="gap-3 pb-4">
						<div class="flex items-start justify-between gap-3">
							<div class="text-muted-foreground flex items-center gap-2 font-mono text-xs">
								<Calendar class="size-3.5" />
								{w.code} · Week {w.weekNumber} · {w.sessionDurationMinutes}min
							</div>
							<Badge variant="outline" class="gap-1 shrink-0">
								<Icon class="size-3 {statusColor(w.status)}" />
								{statusLabel(w.status)}
							</Badge>
						</div>
						<Card.Title class="text-xl leading-tight group-hover:underline">
							{w.title}
						</Card.Title>
						{#if w.scheduledAt}
							<div class="text-muted-foreground flex items-center gap-1.5 text-xs">
								<CalendarClock class="size-3.5 text-amber-600" />
								<span>{fmtSchedule(w.scheduledAt)}</span>
							</div>
						{/if}
					</Card.Header>

					<Card.Content class="flex flex-1 flex-col justify-between gap-5">
						<p class="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
							{w.description}
						</p>

						<div>
							<div class="mb-2 flex items-center justify-between text-xs">
								<span class="text-muted-foreground flex items-center gap-1.5">
									<MessageCircleQuestion class="size-3.5" />
									{w.answered} of {w.total} answered
								</span>
								<span class="tabular-nums font-medium">{pct}%</span>
							</div>
							<Progress value={pct} class="h-2" />
						</div>

						<div class="text-muted-foreground flex items-center justify-between pt-1 text-xs">
							<div class="flex gap-4">
								<span class="flex items-center gap-1.5">
									<Users class="size-3.5" /> {w.participants} participants
								</span>
								<span class="flex items-center gap-1.5">
									<Clock class="size-3.5" /> {Number(w.hours)}h logged
								</span>
							</div>
							<span class="text-foreground flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
								Open <ArrowRight class="size-3" />
							</span>
						</div>
					</Card.Content>
				</Card.Root>
			</a>
		{/each}
	</div>
</div>
