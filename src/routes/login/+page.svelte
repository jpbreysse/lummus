<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		loading = true;

		try {
			const { error: err } = await authClient.signIn.email({
				email: email.trim(),
				password
			});
			if (err) throw new Error(err.message);
			await goto(redirectTo, { invalidateAll: true });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center px-6">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-xl">Sign in</Card.Title>
			<Card.Description>Welcome back to Lummus.</Card.Description>
		</Card.Header>
		<form onsubmit={handleSubmit}>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input id="email" type="email" bind:value={email} required autocomplete="username" />
				</div>
				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						type="password"
						bind:value={password}
						required
						autocomplete="current-password"
					/>
				</div>

				{#if error}
					<p class="text-destructive text-sm">{error}</p>
				{/if}
			</Card.Content>
			<Card.Footer class="flex flex-col gap-3">
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Loading…' : 'Sign in'}
				</Button>
				<p class="text-muted-foreground text-center text-xs">
					Signup is invite-only. Ask an admin for a link.
				</p>
			</Card.Footer>
		</form>
	</Card.Root>
</div>
