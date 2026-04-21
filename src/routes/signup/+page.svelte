<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let loading = $state(false);
</script>

<div class="flex min-h-screen items-center justify-center px-6">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-xl">Create account</Card.Title>
			<Card.Description>
				{#if data.inviteEmail}
					You've been invited as <strong>{data.inviteEmail}</strong>.
				{:else}
					Complete your Lummus account.
				{/if}
			</Card.Description>
		</Card.Header>
		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
		>
			<input type="hidden" name="inviteCode" value={data.inviteCode} />
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input id="name" name="name" required autocomplete="name" />
				</div>
				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						required
						autocomplete="email"
						value={data.inviteEmail ?? ''}
						readonly={!!data.inviteEmail}
					/>
				</div>
				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</div>

				{#if form?.error}
					<p class="text-destructive text-sm">{form.error}</p>
				{/if}
			</Card.Content>
			<Card.Footer class="flex flex-col gap-3">
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Creating…' : 'Create account'}
				</Button>
				<a href="/login" class="text-muted-foreground hover:text-foreground text-xs">
					Already have an account? Sign in
				</a>
			</Card.Footer>
		</form>
	</Card.Root>
</div>
