<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Users from '@lucide/svelte/icons/users';
	import MessageCircleQuestion from '@lucide/svelte/icons/message-circle-question';
	import Clock from '@lucide/svelte/icons/clock';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Circle from '@lucide/svelte/icons/circle';
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import Pin from '@lucide/svelte/icons/pin';

	let { data } = $props();

	const answerRate = $derived(
		data.summary.totalQuestions === 0
			? 0
			: Math.round((data.summary.answered / data.summary.totalQuestions) * 100)
	);

	const statusIcon = (s: string) =>
		s === 'completed' ? CircleCheck : s === 'in_progress' ? CircleDot : Circle;
	const statusColor = (s: string) =>
		s === 'completed'
			? 'text-emerald-600'
			: s === 'in_progress'
				? 'text-amber-600'
				: 'text-muted-foreground';

	const fmtFull = (d: string | Date) =>
		new Date(d).toLocaleString(undefined, {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

	const fmtShort = (d: string | Date) =>
		new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

	const countdown = (d: string | Date) => {
		const diffMs = new Date(d).getTime() - Date.now();
		const days = Math.floor(diffMs / 86_400_000);
		const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
		if (days >= 1) return `in ${days} day${days > 1 ? 's' : ''}`;
		if (hours >= 1) return `in ${hours}h`;
		return 'soon';
	};
</script>

<div class="mx-auto max-w-6xl px-6 py-8">
	<header class="mb-8 flex items-end justify-between">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Lummus Phase 2</h1>
			<p class="text-muted-foreground text-sm">Workshop programme — live tracker</p>
		</div>
		<Badge variant="secondary">Dev</Badge>
	</header>

	{#if data.nextWorkshop}
		<a
			href="/workshops/{data.nextWorkshop.code}"
			class="group mb-6 block rounded-lg border border-amber-300 bg-amber-50/50 p-4 transition-colors hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
		>
			<div class="flex items-center gap-3">
				<div class="rounded-full bg-amber-100 p-2 dark:bg-amber-900/40">
					<CalendarClock class="size-5 text-amber-700 dark:text-amber-400" />
				</div>
				<div class="min-w-0 flex-1">
					<div class="text-muted-foreground text-xs">
						Next meeting · {countdown(data.nextWorkshop.scheduledAt!)}
					</div>
					<div class="truncate text-sm font-medium group-hover:underline">
						<span class="font-mono">{data.nextWorkshop.code}</span> · {data.nextWorkshop.title}
					</div>
					<div class="text-muted-foreground mt-0.5 text-xs">
						{fmtFull(data.nextWorkshop.scheduledAt!)} · {data.nextWorkshop.sessionDurationMinutes} min
					</div>
				</div>
			</div>
		</a>
	{/if}

	<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="pb-2">
				<div class="flex items-center justify-between">
					<Card.Description>Workshops</Card.Description>
					<Calendar class="text-muted-foreground size-4" />
				</div>
				<Card.Title class="text-3xl tabular-nums">{data.summary.workshopCount}</Card.Title>
			</Card.Header>
			<Card.Content class="text-muted-foreground flex gap-3 text-xs">
				<span class="flex items-center gap-1">
					<Circle class="size-3" />
					{data.summary.byStatus.upcoming ?? 0} up
				</span>
				<span class="flex items-center gap-1 text-amber-600">
					<CircleDot class="size-3" />
					{data.summary.byStatus.in_progress ?? 0} live
				</span>
				<span class="flex items-center gap-1 text-emerald-600">
					<CircleCheck class="size-3" />
					{data.summary.byStatus.completed ?? 0} done
				</span>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="pb-2">
				<div class="flex items-center justify-between">
					<Card.Description>Team</Card.Description>
					<Users class="text-muted-foreground size-4" />
				</div>
				<Card.Title class="text-3xl tabular-nums">{data.summary.memberCount}</Card.Title>
			</Card.Header>
			<Card.Content class="text-muted-foreground text-xs">participants</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="pb-2">
				<div class="flex items-center justify-between">
					<Card.Description>Questions</Card.Description>
					<MessageCircleQuestion class="text-muted-foreground size-4" />
				</div>
				<Card.Title class="text-3xl tabular-nums">
					{data.summary.answered}<span class="text-muted-foreground text-lg">/{data.summary.totalQuestions}</span>
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<Progress value={answerRate} class="h-1.5" />
				<div class="text-muted-foreground mt-1 text-xs">{answerRate}% answered</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="pb-2">
				<div class="flex items-center justify-between">
					<Card.Description>Hours logged</Card.Description>
					<Clock class="text-muted-foreground size-4" />
				</div>
				<Card.Title class="text-3xl tabular-nums">{data.summary.totalHours}h</Card.Title>
			</Card.Header>
			<Card.Content class="text-muted-foreground text-xs">across all workshops</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-6 md:grid-cols-[2fr_1fr]">
		<section>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Programme progress</h2>
				<Button href="/workshops" variant="ghost" size="sm">All workshops →</Button>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				{#each data.workshopProgress as w (w.id)}
					{@const pct = w.total ? Math.round((w.answered / w.total) * 100) : 0}
					{@const Icon = statusIcon(w.status)}
					<a
						href="/workshops/{w.code}"
						class="hover:bg-accent/40 group rounded-lg border p-4 transition-colors"
					>
						<div class="mb-2 flex items-start justify-between gap-2">
							<div class="min-w-0">
								<div class="text-muted-foreground font-mono text-xs">
									{w.code} · Week {w.weekNumber}{#if w.scheduledAt} · {fmtShort(w.scheduledAt)}{/if}
								</div>
								<div class="truncate text-sm font-medium">{w.title}</div>
							</div>
							<Icon class="size-4 shrink-0 {statusColor(w.status)}" />
						</div>
						<Progress value={pct} class="h-1.5" />
						<div class="text-muted-foreground mt-2 flex justify-between text-xs">
							<span>{w.answered}/{w.total} answered</span>
							<span class="flex gap-3">
								<span class="flex items-center gap-1"><Users class="size-3" />{w.participants}</span>
								<span class="flex items-center gap-1"><Clock class="size-3" />{Number(w.hours)}h</span>
							</span>
						</div>
					</a>
				{/each}
			</div>
		</section>

		<aside>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="flex items-center gap-2 text-lg font-semibold">
					<Megaphone class="size-4" /> News
				</h2>
				<Button href="/announcements" variant="ghost" size="sm">All →</Button>
			</div>
			<div class="space-y-2">
				{#each data.recentAnnouncements as a (a.id)}
					<div
						class="rounded-lg border p-3 {a.pinned ? 'border-amber-300 bg-amber-50/30' : ''}"
					>
						<div class="flex items-start gap-2">
							{#if a.pinned}
								<Pin class="mt-0.5 size-3.5 shrink-0 text-amber-600" />
							{/if}
							<div class="min-w-0">
								<div class="truncate text-sm font-medium">{a.title}</div>
								<p class="text-muted-foreground mt-1 line-clamp-3 text-xs">{a.body}</p>
								<div class="text-muted-foreground mt-1 text-[10px]">
									{a.authorName ?? 'Unknown'} · {fmtShort(a.createdAt)}
								</div>
							</div>
						</div>
					</div>
				{:else}
					<p class="text-muted-foreground text-xs">
						No posts yet. <a href="/announcements" class="underline hover:no-underline">Add one</a>.
					</p>
				{/each}
			</div>
		</aside>
	</div>
</div>
