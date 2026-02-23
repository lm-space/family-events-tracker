<script>
    import { onMount } from "svelte";
    import { API_BASE, token } from "../../lib/stores";

    let channelName = "";
    let newPassword = "";
    let confirmPassword = "";
    let loading = false;
    let message = "";
    let error = "";

    onMount(async () => {
        try {
            const res = await fetch(`${API_BASE}/me`, {
                headers: { Authorization: `Bearer ${$token}` },
            });
            if (res.ok) {
                const user = await res.json();
                channelName = user.channel_name || "";
            }
        } catch (e) {
            console.error(e);
        }
    });

    async function save() {
        if (newPassword && newPassword !== confirmPassword) {
            error = "Passwords do not match";
            return;
        }

        loading = true;
        message = "";
        error = "";

        try {
            const body = { channel_name: channelName };
            if (newPassword) body.password = newPassword;

            const res = await fetch(`${API_BASE}/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${$token}`,
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                message = "Profile updated successfully!";
                newPassword = "";
                confirmPassword = "";
            } else {
                const data = await res.json();
                error = data.error || "Failed to update profile";
            }
        } catch (e) {
            error = e.message;
        } finally {
            loading = false;
        }
    }
</script>

<div class="card">
    <h2>My Profile</h2>

    {#if message}
        <div class="success">{message}</div>
    {/if}
    {#if error}
        <div class="error">{error}</div>
    {/if}

    <div class="form-group">
        <label for="cname">Channel Name</label>
        <p class="hint">This name will be displayed next to your videos.</p>
        <input type="text" id="cname" bind:value={channelName} />
    </div>

    <hr />
    <h3>Change Password</h3>

    <div class="form-group">
        <label for="pass">New Password</label>
        <input
            type="password"
            id="pass"
            bind:value={newPassword}
            placeholder="Leave blank to keep current"
        />
    </div>

    <div class="form-group">
        <label for="cpass">Confirm New Password</label>
        <input type="password" id="cpass" bind:value={confirmPassword} />
    </div>

    <button on:click={save} disabled={loading}>
        {loading ? "Saving..." : "Save Changes"}
    </button>
</div>

<style>
    .card {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        max-width: 600px;
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
    .hint {
        font-size: 0.85rem;
        color: #6b7280;
        margin-bottom: 0.5rem;
        margin-top: -0.25rem;
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
    .success {
        padding: 1rem;
        background: #ecfdf5;
        color: #065f46;
        border-radius: 6px;
        margin-bottom: 1rem;
    }
    .error {
        padding: 1rem;
        background: #fef2f2;
        color: #991b1b;
        border-radius: 6px;
        margin-bottom: 1rem;
    }
    hr {
        margin: 2rem 0;
        border: 0;
        border-top: 1px solid #e5e7eb;
    }
    h3 {
        margin-bottom: 1rem;
        color: #1f2937;
    }
</style>
