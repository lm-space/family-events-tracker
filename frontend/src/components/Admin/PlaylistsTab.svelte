<script>
    import { playlists, API_BASE, refreshData } from "../../lib/stores";
    let newName = "";
    let isGlobal = true;

    // Inline Edit State
    let editingId = null;
    let editName = "";

    async function create() {
        if (!newName) return;
        await fetch(API_BASE + "/playlists", {
            method: "POST",
            body: JSON.stringify({ name: newName, is_global: isGlobal }),
        });
        newName = "";
        isGlobal = true;
        refreshData();
    }

    async function del(id) {
        if (
            !confirm(
                "Delete playlist? This will remove all videos from this playlist.",
            )
        )
            return;
        await fetch(`${API_BASE}/playlists/${id}`, { method: "DELETE" });
        refreshData();
    }

    function startEdit(p) {
        editingId = p.id;
        editName = p.name;
        setTimeout(() => {
            const el = document.getElementById(`edit-playlist-${p.id}`);
            if (el) el.focus();
        }, 0);
    }

    async function saveEdit(id) {
        if (!editName.trim()) return cancelEdit();

        const original = $playlists.find((p) => p.id === id);
        if (original && original.name === editName) {
            cancelEdit();
            return;
        }

        await fetch(`${API_BASE}/playlists/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name: editName }),
        });

        // Optimistic
        playlists.update((all) =>
            all.map((p) => (p.id === id ? { ...p, name: editName } : p)),
        );
        cancelEdit();
    }

    function cancelEdit() {
        editingId = null;
        editName = "";
    }

    function handleKeydown(e, id) {
        if (e.key === "Enter") saveEdit(id);
        if (e.key === "Escape") cancelEdit();
    }

    // DND
    let draggedItem = null;
    let dragOverItem = null;

    function handleDragStart(e, item) {
        draggedItem = item;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify(item));
        setTimeout(() => e.target.classList.add("dragging"), 0);
    }

    function handleDragEnd(e) {
        e.target.classList.remove("dragging");
        draggedItem = null;
        dragOverItem = null;
    }

    function handleDragOver(e, item) {
        e.preventDefault();
        if (draggedItem === item) return;
        dragOverItem = item;
    }

    async function handleDrop(e, targetItem) {
        e.preventDefault();
        if (!draggedItem || draggedItem === targetItem) return;

        const all = [...$playlists];
        const fromIndex = all.indexOf(draggedItem);
        const toIndex = all.indexOf(targetItem);

        if (fromIndex < 0 || toIndex < 0) return;

        all.splice(fromIndex, 1);
        all.splice(toIndex, 0, draggedItem);

        playlists.set(all);
        await saveOrder(all);
        draggedItem = null;
        dragOverItem = null;
    }

    async function saveOrder(items) {
        const payload = items.map((p, idx) => ({
            id: p.id,
            display_order: idx,
        }));
        await fetch(`${API_BASE}/playlists/reorder`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async function deletePlaylist(id) {
        if (!confirm("Delete this playlist?")) return;
        await fetch(`${API_BASE}/playlists/${id}`, { method: "DELETE" });
        refreshData();
    }
</script>

<div class="card">
    <h2>Playlists</h2>
    <div class="add-row">
        <input
            type="text"
            placeholder="New Playlist Name"
            bind:value={newName}
            on:keydown={(e) => e.key === "Enter" && create()}
        />
        <label title="Available to all channels" class="checkbox-label">
            <input type="checkbox" bind:checked={isGlobal} /> Global
        </label>
        <button on:click={create}>Add</button>
    </div>

    <div class="list">
        {#each $playlists as p (p.id)}
            <div
                class="item"
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, p)}
                on:dragend={handleDragEnd}
                on:dragover={(e) => handleDragOver(e, p)}
                on:drop={(e) => handleDrop(e, p)}
            >
                {#if editingId === p.id}
                    <input
                        id="edit-pl-{p.id}"
                        type="text"
                        bind:value={editName}
                        on:blur={() => saveEdit(p.id)}
                        on:keydown={(e) => handleKeydown(e, p.id)}
                        class="edit-input"
                    />
                {:else}
                    <div class="name-row">
                        <div class="drag-handle">⋮⋮</div>
                        <span class="name" title="Click to edit">
                            {p.name}
                        </span>
                        <button class="icon-btn" on:click={() => startEdit(p)}
                            >✎</button
                        >
                    </div>
                {/if}
                <button class="btn-danger" on:click={() => deletePlaylist(p.id)}
                    >Delete</button
                >
            </div>
        {/each}
    </div>
</div>

<style>
    .card {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    h2 {
        margin-top: 0;
    }
    .add-row {
        display: flex;
        gap: 10px;
        margin-bottom: 2rem;
    }
    .add-row input {
        flex: 1;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    button {
        padding: 10px 20px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .list {
        display: flex;
        flex-direction: column;
    }
    .item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid #eee;
        background: white;
    }
    .item.dragging {
        opacity: 0.5;
        background: #f0f9ff;
        border: 2px dashed #2563eb;
    }
    .btn-danger {
        background: #ef4444;
    }

    .name-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }
    .drag-handle {
        cursor: grab;
        color: #ccc;
        margin-right: 12px;
        font-weight: bold;
        user-select: none;
    }
    .name {
        font-weight: 500;
        cursor: pointer; /* Keep cursor pointer for name for startEdit */
    }
    .name:hover {
        color: #2563eb;
        text-decoration: underline;
    }

    .edit-input {
        font-size: 1rem;
        padding: 4px;
        border: 1px solid #2563eb;
        border-radius: 4px;
        max-width: 300px;
    }
    .icon-btn {
        background: none;
        border: none;
        padding: 0;
        font-size: 0.9rem;
        cursor: pointer;
        color: #9ca3af;
    }
    .icon-btn:hover {
        color: #2563eb;
    }
</style>
