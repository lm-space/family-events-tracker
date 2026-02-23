<script>
    import { categories, API_BASE, refreshData } from "../../lib/stores";
    let newName = "";
    let isGlobal = true;

    // Inline Edit State
    let editingId = null;
    let editName = "";

    async function create() {
        if (!newName) return;
        await fetch(API_BASE + "/categories", {
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
                "Delete category? WARNING: All videos in this category will be PERMANENTLY DELETED.",
            )
        )
            return;
        await fetch(`${API_BASE}/categories/${id}`, { method: "DELETE" });
        refreshData();
    }

    async function move(id, dir) {
        let cats = [...$categories];
        const idx = cats.findIndex((c) => c.id === id);
        if (idx === -1) return;

        if (idx + dir < 0 || idx + dir >= cats.length) return;
        const temp = cats[idx];
        cats[idx] = cats[idx + dir];
        cats[idx + dir] = temp;

        // Optimistic update
        categories.set(cats);

        const updates = cats.map((c, i) => ({
            id: c.id,
            display_order: i + 1,
        }));
        await fetch(API_BASE + "/categories/reorder", {
            method: "POST",
            body: JSON.stringify(updates),
        });
        refreshData();
    }

    function startEdit(cat) {
        editingId = cat.id;
        editName = cat.name;
        // Wait for DOM update
        setTimeout(() => {
            const el = document.getElementById(`edit-cat-${cat.id}`);
            if (el) el.focus();
        }, 0);
    }

    async function saveEdit(id) {
        if (!editName.trim()) return cancelEdit();

        const original = $categories.find((c) => c.id === id);
        if (original && original.name === editName) {
            cancelEdit();
            return;
        }

        await fetch(`${API_BASE}/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name: editName }),
        });

        // Optimistic
        categories.update((all) =>
            all.map((c) => (c.id === id ? { ...c, name: editName } : c)),
        );
        cancelEdit();
    }

    function cancelEdit() {
        editingId = null;
        editName = "";
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

        const all = [...$categories];
        const fromIndex = all.indexOf(draggedItem);
        const toIndex = all.indexOf(targetItem);

        if (fromIndex < 0 || toIndex < 0) return;

        all.splice(fromIndex, 1);
        all.splice(toIndex, 0, draggedItem);

        categories.set(all);
        await saveOrder(all);
        draggedItem = null;
        dragOverItem = null;
    }

    async function saveOrder(items) {
        const payload = items.map((c, idx) => ({
            id: c.id,
            display_order: idx,
        }));
        await fetch(`${API_BASE}/categories/reorder`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    function handleKeydown(e, id) {
        if (e.key === "Enter") saveEdit(id);
        if (e.key === "Escape") cancelEdit();
    }
</script>

<div class="card">
    <h2>Categories</h2>
    <div class="add-row">
        <input
            type="text"
            placeholder="New Category Name"
            bind:value={newName}
            on:keydown={(e) => e.key === "Enter" && create()}
        />
        <label title="Available to all channels" class="checkbox-label">
            <input type="checkbox" bind:checked={isGlobal} /> Global
        </label>
        <button on:click={create}>Add</button>
    </div>

    <div class="list">
        {#each $categories as c (c.id)}
            <div
                class="item"
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, c)}
                on:dragend={handleDragEnd}
                on:dragover={(e) => handleDragOver(e, c)}
                on:drop={(e) => handleDrop(e, c)}
            >
                {#if editingId === c.id}
                    <input
                        id="edit-cat-{c.id}"
                        type="text"
                        bind:value={editName}
                        on:blur={() => saveEdit(c.id)}
                        on:keydown={(e) => handleKeydown(e, c.id)}
                        class="edit-input"
                    />
                {:else}
                    <div class="name-row">
                        <div class="drag-handle">⋮⋮</div>
                        <span
                            on:click={() => startEdit(c)}
                            class="name"
                            title="Click to edit"
                        >
                            {c.name}
                        </span>
                        <button class="icon-btn" on:click={() => startEdit(c)}
                            >✎</button
                        >
                    </div>
                {/if}
                <button class="btn-danger" on:click={() => del(c.id)}
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
        padding: 1rem;
        border-bottom: 1px solid #eee;
        align-items: center;
        background: white;
    }
    .item.dragging {
        opacity: 0.5;
        background: #f0f9ff;
        border: 2px dashed #2563eb;
    }
    .actions {
        display: flex;
        gap: 0.5rem;
    }
    .btn-danger {
        background: #ef4444;
    }

    .name-row {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        flex: 1;
    }
    .name {
        font-weight: 500;
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
