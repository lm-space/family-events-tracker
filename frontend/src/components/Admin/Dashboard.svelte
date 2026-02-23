<script lang="ts">
    import { onMount } from "svelte";
    import { events, API_BASE } from "../../lib/stores";
    import EventsTab from "./EventsTab.svelte";
    import DiaryTab from "./DiaryTab.svelte";
    import HabitsTab from "./HabitsTab.svelte";

    let activeTab = "habits";

    async function fetchEvents() {
        try {
            const res = await fetch(`${API_BASE}/events`);
            if (res.ok) {
                const data = await res.json();
                events.set(data);
            }
        } catch (e) {
            console.error(e);
        }
    }

    onMount(() => {
        fetchEvents();
        const interval = setInterval(fetchEvents, 10000); // Live poll
        return () => clearInterval(interval);
    });

    function logout() {
        localStorage.removeItem("token");
        window.location.reload();
    }
</script>

<div class="admin-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="brand">
            <div class="logo-circle">D</div>
            <span>DLE Admin</span>
        </div>

        <nav>
            <button
                class:active={activeTab === "habits"}
                on:click={() => (activeTab = "habits")}
            >
                <span class="icon">✓</span> Habits
            </button>
            <button
                class:active={activeTab === "diary"}
                on:click={() => (activeTab = "diary")}
            >
                <span class="icon">📔</span> Diary
            </button>
            <button
                class:active={activeTab === "events"}
                on:click={() => (activeTab = "events")}
            >
                <span class="icon">🎙️</span> Recordings
            </button>
            <button
                class:active={activeTab === "analysis"}
                on:click={() => (activeTab = "analysis")}
            >
                <span class="icon">🧠</span> Analysis
            </button>
            <button
                class:active={activeTab === "settings"}
                on:click={() => (activeTab = "settings")}
            >
                <span class="icon">⚙️</span> Settings
            </button>
        </nav>

        <div class="footer-nav">
            <button on:click={logout}>
                <span class="icon">🚪</span> Logout
            </button>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
        <header class="top-bar">
            <h2>
                {activeTab === "habits"
                    ? "Family Habits"
                    : activeTab === "diary"
                      ? "Personal Diary"
                      : activeTab === "events"
                        ? "Voice Recordings"
                        : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
            <div class="user-profile">
                <span>Admin</span>
                <div class="avatar">A</div>
            </div>
        </header>

        <div class="content-area">
            {#if activeTab === "habits"}
                <HabitsTab />
            {:else if activeTab === "diary"}
                <DiaryTab />
            {:else if activeTab === "events"}
                <EventsTab />
            {:else if activeTab === "analysis"}
                <div class="placeholder-page">
                    <h3>Analysis Dashboard</h3>
                    <p>Coming soon: Visualizations of your extracted data.</p>
                </div>
            {:else}
                <div class="placeholder-page">
                    <h3>Settings</h3>
                    <p>App configuration.</p>
                </div>
            {/if}
        </div>
    </main>
</div>

<style>
    :global(body) {
        margin: 0;
        font-family: "Inter", sans-serif;
        background: #f3f4f6;
    }

    .admin-shell {
        display: flex;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
        width: 260px;
        background: #0f172a; /* Slate 900 */
        color: #e2e8f0;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #1e293b;
        flex-shrink: 0;
    }

    .brand {
        padding: 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 700;
        font-size: 1.2rem;
        border-bottom: 1px solid #1e293b;
        color: white;
    }
    .logo-circle {
        width: 32px;
        height: 32px;
        background: #3b82f6;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    nav {
        flex: 1;
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    nav button,
    .footer-nav button {
        background: none;
        border: none;
        width: 100%;
        text-align: left;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        color: #94a3b8;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.2s;
    }

    nav button:hover {
        background: rgba(255, 255, 255, 0.05);
        color: white;
    }
    nav button.active {
        background: #3b82f6;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .icon {
        font-size: 1.1rem;
    }

    .footer-nav {
        padding: 16px;
        border-top: 1px solid #1e293b;
    }

    /* Main Content */
    .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: #f8fafc;
        overflow: hidden;
    }

    .top-bar {
        background: white;
        height: 64px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 32px;
        flex-shrink: 0;
    }
    .top-bar h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #1e293b;
    }

    .user-profile {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.9rem;
        color: #64748b;
    }
    .avatar {
        width: 36px;
        height: 36px;
        background: #e2e8f0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #475569;
    }

    .content-area {
        flex: 1;
        overflow-y: auto;
        padding: 32px;
    }

    .placeholder-page {
        background: white;
        padding: 40px;
        text-align: center;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        color: #64748b;
    }
</style>
