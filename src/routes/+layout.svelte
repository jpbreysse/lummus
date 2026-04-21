<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Users from '@lucide/svelte/icons/users';
	import MessageCircleQuestion from '@lucide/svelte/icons/message-circle-question';
	import Clock from '@lucide/svelte/icons/clock';
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import UserRound from '@lucide/svelte/icons/user-round';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { children, data } = $props();

	const handleSignOut = async () => {
		await authClient.signOut();
		await goto('/login');
	};

	const nav = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/workshops', label: 'Workshops', icon: Calendar },
		{ href: '/team', label: 'Team', icon: Users },
		{ href: '/questions', label: 'Questions', icon: MessageCircleQuestion },
		{ href: '/hours', label: 'Hours', icon: Clock },
		{ href: '/announcements', label: 'Announcements', icon: Megaphone },
		{ href: '/users', label: 'Users', icon: UserRound }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if page.url.pathname.startsWith('/login') || page.url.pathname.startsWith('/signup')}
	<div class="bg-background text-foreground min-h-screen">
		{@render children()}
	</div>
{:else}
<div class="flex min-h-screen bg-background text-foreground">
	<aside class="bg-muted/40 flex w-56 shrink-0 flex-col border-r">
		<div class="px-5 py-5">
			<a href="/" class="text-base font-semibold tracking-tight">Lummus</a>
			<p class="text-muted-foreground mt-0.5 text-xs">Phase 2 tracker</p>
		</div>

		<nav class="flex-1 px-3 py-2">
			<ul class="space-y-0.5">
				{#each nav as item (item.href)}
					{@const active = isActive(item.href)}
					<li>
						<a
							href={item.href}
							class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors {active
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:bg-background/60 hover:text-foreground'}"
						>
							<item.icon class="size-4" />
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		{#if data.user}
			<div class="border-t px-3 py-3">
				<div class="mb-2 px-2">
					<div class="truncate text-sm font-medium">{data.user.name}</div>
					<div class="text-muted-foreground truncate text-xs">{data.user.email}</div>
				</div>
				<button
					type="button"
					onclick={handleSignOut}
					class="text-muted-foreground hover:bg-background/60 hover:text-foreground flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
				>
					<LogOut class="size-4" />
					Sign out
				</button>
			</div>
		{/if}
	</aside>

	<main class="min-w-0 flex-1">
		{@render children()}
	</main>
</div>
{/if}
