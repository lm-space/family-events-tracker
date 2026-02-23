<script>
    import { onMount } from "svelte";
    import { API_BASE } from "../../lib/stores";

    let inviteEmail = "";
    let magicLink = "";
    let loading = false;
    let error = "";
    let users = [];

    async function loadUsers() {
        try {
            const res = await fetch(`${API_BASE}/users`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`, // Ensure we send token
                },
            });
            if (res.ok) {
                users = await res.json();
            }
        } catch (e) {
            console.error(e);
        }
    }

    onMount(() => {
        loadUsers();
    });

    async function inviteUser() {
        if (!inviteEmail) return;
        loading = true;
        error = "";
        magicLink = "";

        try {
            const res = await fetch(`${API_BASE}/invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                // In a real app, email is sent. Here we show the link.
                magicLink = `${window.location.origin}/login?magic=${data.magic_link}`;
                inviteEmail = "";
                loadUsers(); // Refresh list
            } else {
                error = data.error || "Failed to invite";
            }
        } catch (e) {
            error = e.message;
        } finally {
            loading = false;
        }
    }
</script>

<div class="card">
    <h2>Invite New User</h2>
    <p>
        Invite a new admin/creator. They will receive their own Channel based on
        their email.
    </p>

    <div class="form-group">
        <label for="email">Email Address</label>
        <input
            type="email"
            id="email"
            bind:value={inviteEmail}
            placeholder="friend@example.com"
        />
    </div>

    <button on:click={inviteUser} disabled={loading}>
        {loading ? "Generating..." : "Generate Invite Link"}
    </button>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if magicLink}
        <div class="success-box">
            <h3>Invite Generated!</h3>
            <p>Share this secret link with the user:</p>
            <div class="code-block">
                {magicLink}
            </div>
            <button
                class="copy-btn"
                on:click={() => navigator.clipboard.writeText(magicLink)}
                >Copy Link</button
            >
        </div>
    {/if}
</div>

<div class="card" style="margin-top: 2rem;">
    <h2>Users</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Channel Name</th>
                <th>Joined</th>
            </tr>
        </thead>
        <tbody>
            {#each users as u}
                <tr>
                    <td>{u.id}</td>
                    <td>{u.email}</td>
                    <td>{u.channel_name || "-"}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .card {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        max-width: 100%;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
    }
    th,
    td {
        text-align: left;
        padding: 0.75rem;
        border-bottom: 1px solid #eee;
    }
    th {
        font-weight: 600;
        color: #374151;
        background: #f9fafb;
    }
    .form-group {
        margin-bottom: 1.5rem;
    }
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #374151;
    }
    input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 1rem;
    }
    button {
        background: #2563eb;
        color: white;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
    }
    button:disabled {
        background: #93c5fd;
        cursor: not-allowed;
    }
    .error {
        margin-top: 1rem;
        color: #ef4444;
    }
    .success-box {
        margin-top: 2rem;
        background: #ecfdf5;
        border: 1px solid #10b981;
        padding: 1.5rem;
        border-radius: 8px;
    }
    .code-block {
        background: white;
        padding: 1rem;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-family: monospace;
        word-break: break-all;
        margin: 1rem 0;
    }
    .copy-btn {
        background: #10b981;
        font-size: 0.9rem;
        padding: 0.5rem 1rem;
    }
</style>
