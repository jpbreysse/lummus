<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';

	let { data } = $props();
</script>

<div class="mx-auto max-w-5xl px-6 py-8">
	<header class="mb-6">
		<h1 class="text-2xl font-semibold tracking-tight">Hours</h1>
		<p class="text-muted-foreground text-sm">{data.total}h logged across {data.entries.length} entries</p>
	</header>

	<div class="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
		{#each data.byMember as b (b.memberName)}
			<Card.Root>
				<Card.Content class="flex items-baseline justify-between py-3">
					<span class="text-sm">{b.memberName}</span>
					<span class="font-mono text-sm">{Number(b.total)}h</span>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<div class="rounded-lg border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Member</Table.Head>
					<Table.Head>Workshop</Table.Head>
					<Table.Head>Kind</Table.Head>
					<Table.Head class="text-right">Hours</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.entries as e (e.id)}
					<Table.Row>
						<Table.Cell class="font-medium">{e.memberName ?? '—'}</Table.Cell>
						<Table.Cell class="font-mono text-xs">{e.workshopCode ?? '—'}</Table.Cell>
						<Table.Cell class="text-muted-foreground text-sm">{e.kind}</Table.Cell>
						<Table.Cell class="text-right font-mono">{e.hours}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>
