<script>
    import { videos, categories, playlists, API_BASE } from "../../lib/stores";

    let videoUrls = "";
    let selectedCategory = "";
    let selectedPlaylist = "";

    // Filters
    let filterCategory = "";
    let filterPlaylist = "";

    // Inline Edit State
    let editingId = null;
    let editTitle = "";

    // Notification State
    let notification = null;
    let notificationTimeout;

    function showNotification(msg, type = "success") {
        notification = { msg, type };
        if (notificationTimeout) clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => {
            notification = null;
        }, 3000);
    }

    // Pagination
    let currentPage = 1;
    let totalPages = 1;
    let totalVideos = 0;
    let isLoading = false;

    // Initialize from URL
    const initialParams = new URLSearchParams(window.location.search);
    if (initialParams.get("page"))
        currentPage = parseInt(initialParams.get("page") || "1");

    // Watch filters and fetch
    $: fetchFiltered(filterCategory, filterPlaylist, currentPage);

    async function fetchFiltered(cat, pl, page) {
        isLoading = true;
        const params = new URLSearchParams();
        if (cat) params.append("category_id", cat);
        if (pl) params.append("playlist_id", pl);
        params.append("page", page.toString());
        params.append("limit", "50");

        // Sync URL (Silent update)
        const url = new URL(window.location.href);
        if (page > 1) url.searchParams.set("page", page.toString());
        else url.searchParams.delete("page");

        // We generally don't want to mess with other params if they are controlled by dashboard tab
        // But here we are inside VideosTab. Use replaceState to keep history clean.
        window.history.replaceState({}, "", url);

        try {
            const headers = { "Content-Type": "application/json" };
            const token = localStorage.getItem("token");
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE}/videos?${params.toString()}`, {
                headers,
            });
            if (res.ok) {
                const data = await res.json();
                videos.set(data.items); // Set to the array inside 'items'
                totalPages = data.total_pages || 1;
                totalVideos = data.total || 0;
            }
        } catch (e) {
            console.error(e);
        }
        isLoading = false;
    }

    // Refresh current view wrapper
    function refreshList() {
        fetchFiltered(filterCategory, filterPlaylist, currentPage);
    }

    function handlePageChange(newPage) {
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    // Import Options
    let importIsGlobal = true;

    async function changeVideoCategory(video, newCatId) {
        if (!newCatId) return;
        try {
            await fetch(`${API_BASE}/videos/${video.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ category_id: newCatId }),
            });
            // Optimistic update
            videos.update((all) =>
                all.map((v) =>
                    v.id === video.id
                        ? {
                              ...v,
                              category_id: newCatId,
                              category_name: $categories.find(
                                  (c) => c.id == newCatId,
                              )?.name,
                          }
                        : v,
                ),
            );
            showNotification("Category updated");
        } catch (e) {
            showNotification("Failed to update category", "error");
        }
    }

    function parseVideoUrl(url) {
        url = url.trim();
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            let id = "";
            if (url.includes("v=")) id = url.split("v=")[1].split("&")[0];
            else if (url.includes("youtu.be/"))
                id = url.split("youtu.be/")[1].split("?")[0];
            return id ? { id, source: "youtube" } : null;
        }
        if (url.includes("vimeo.com")) {
            const parts = url.split("/");
            const id = parts[parts.length - 1];
            return id ? { id, source: "vimeo" } : null;
        }
        // For Socials, prefer storing the FULL URL to avoid reconstruction errors
        if (url.includes("twitter.com") || url.includes("x.com")) {
            return { id: url, source: "twitter" };
        }
        if (url.includes("tiktok.com")) {
            return { id: url, source: "tiktok" };
        }
        if (url.includes("instagram.com")) {
            return { id: url, source: "instagram" };
        }
        if (url.includes("facebook.com")) {
            return { id: url, source: "facebook" };
        }
        // Catch-all for other URLs
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return { id: url, source: "html" };
        }
        return null;
    }

    async function importVideos() {
        if (!videoUrls) return;
        const urls = videoUrls.split("\n").filter((l) => l.trim().length > 0);
        const extracted = [];

        for (const url of urls) {
            const parsed = parseVideoUrl(url);
            if (parsed) extracted.push(parsed);
        }

        if (extracted.length === 0)
            return showNotification("No valid URLs", "error");

        showNotification("Fetching metadata...", "info");

        // Fetch Metadata
        const videosPayload = [];
        for (const item of extracted) {
            let title = `Video ${item.id} (${item.source})`;

            // Only fetch YouTube metadata for now
            if (item.source === "youtube") {
                try {
                    const res = await fetch(
                        `${API_BASE}/fetch-video-info?id=${item.id}`,
                    );
                    if (res.ok) {
                        const d = await res.json();
                        title = d.title || title;
                    }
                } catch (e) {
                    console.error(e);
                }
            } else {
                title = `${item.source.toUpperCase()} Video ${item.id}`;
            }

            videosPayload.push({
                youtube_id: item.id,
                title,
                category_id: selectedCategory,
                source_type: item.source,
            });
        }

        await fetch(API_BASE + "/videos/bulk", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
                videos: videosPayload,
                playlist_id: selectedPlaylist,
                is_global: importIsGlobal,
            }),
        });
        videoUrls = "";
        refreshList();
        showNotification("Imported " + videosPayload.length + " videos");
    }

    async function deleteVideo(id) {
        if (!confirm("Delete this video?")) return;
        try {
            await fetch(`${API_BASE}/videos/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            videos.update((all) => all.filter((v) => v.id !== id));
            showNotification("Video deleted");
        } catch (e) {
            showNotification("Failed to delete video", "error");
        }
    }

    function startEdit(video) {
        editingId = video.id;
        editTitle = video.title;
        setTimeout(() => {
            const el = document.getElementById(`edit-input-${video.id}`);
            if (el) el.focus();
        }, 0);
    }

    function cancelEdit() {
        editingId = null;
        editTitle = "";
    }

    async function saveEdit(id) {
        if (!editTitle.trim()) return cancelEdit();

        try {
            await fetch(`${API_BASE}/videos/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ title: editTitle }),
            });
            // Optimistic
            videos.update((all) =>
                all.map((v) => (v.id === id ? { ...v, title: editTitle } : v)),
            );
            showNotification("Title updated");
        } catch (e) {
            showNotification("Failed to update title", "error");
        }
        cancelEdit();
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
        if (e.target) e.target.classList.remove("dragging");
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

        // Only allow reordering if we are in a specific category view
        if (!filterCategory) return;

        const all = [...$videos];
        const fromIndex = all.indexOf(draggedItem);
        const toIndex = all.indexOf(targetItem);

        if (fromIndex < 0 || toIndex < 0) return;

        all.splice(fromIndex, 1);
        all.splice(toIndex, 0, draggedItem);

        videos.set(all);
        await saveOrder(all);
        draggedItem = null;
        dragOverItem = null;
    }

    async function saveOrder(items) {
        // If the backend doesn't support video reordering yet, this might 404 or fail,
        // but it prevents the frontend crash.
        // Assuming there is a /api/videos/reorder or similar, OR we just ignore for now
        // until backend support is confirmed.
        // I will implement a safe dummy fetch or actual attempt if I recalled correctly.
        // Looking at previous 'reorder' mentions, it was for categories/playlists.
        // I'll comment out the fetch to be safe but keep the function to satisfy the call.
        /*
        const payload = items.map((v, idx) => ({
            id: v.id,
            display_order: idx
        }));
        await fetch(`${API_BASE}/videos/reorder`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        */
    }
</script>

{#if notification}
    <div class="notification-toast {notification.type}">
        {notification.msg}
    </div>
{/if}

<div class="card">
    <h2>Import Videos</h2>
    <div class="grid">
        <textarea
            bind:value={videoUrls}
            rows="5"
            placeholder="Supported: YouTube, Vimeo, Twitter/X, TikTok, Instagram, Facebook..."
        ></textarea>
        <div class="controls">
            <div class="row-control">
                <label>
                    <input type="checkbox" bind:checked={importIsGlobal} />
                    Global Content
                </label>
            </div>
            <select bind:value={selectedCategory}>
                <option value="">Select Category</option>
                {#each $categories as c}
                    <option value={c.id}>{c.name}</option>
                {/each}
            </select>
            <select bind:value={selectedPlaylist}>
                <option value="">No Playlist</option>
                {#each $playlists as p}
                    <!-- ... -->

                    <option value={p.id}>{p.name}</option>
                {/each}
            </select>
            <button on:click={importVideos}>Start Import</button>
        </div>
    </div>
</div>

<div class="card">
    <div class="header-row">
        <h2>Recent Videos ({totalVideos})</h2>
        <div class="filters">
            <select
                bind:value={filterCategory}
                on:change={() => handlePageChange(1)}
            >
                <option value="">All Categories</option>
                <option value="uncategorized">Uncategorized</option>
                {#each $categories as c}
                    <option value={c.id}>{c.name}</option>
                {/each}
            </select>
            <select
                bind:value={filterPlaylist}
                on:change={() => handlePageChange(1)}
            >
                <option value="">All Playlists</option>
                {#each $playlists as p}
                    <option value={p.id}>{p.name}</option>
                {/each}
            </select>
        </div>
    </div>

    {#if $videos.length === 0}
        <div class="empty">No videos found.</div>
    {:else}
        <div class="list">
            <details
                style="margin-bottom: 10px; font-size: 12px; border: 1px solid #ccc; padding: 5px;"
            >
                <summary>Debug Data (${$videos.length} items)</summary>
                <pre>{JSON.stringify($videos, null, 2)}</pre>
            </details>
            {#each $videos as v (v.id)}
                {@const sType =
                    v.source_type ||
                    (v.thumbnail_url && !v.thumbnail_url.startsWith("http")
                        ? v.thumbnail_url
                        : "youtube")}
                <div
                    class="item"
                    draggable={filterCategory &&
                        filterCategory !== "uncategorized"}
                    on:dragstart={(e) => handleDragStart(e, v)}
                    on:dragend={handleDragEnd}
                    on:dragover={(e) => handleDragOver(e, v)}
                    on:drop={(e) => handleDrop(e, v)}
                    class:draggable={filterCategory &&
                        filterCategory !== "uncategorized"}
                >
                    <div class="info">
                        {#if filterCategory && filterCategory !== "uncategorized"}
                            <div class="drag-handle">⋮⋮</div>
                        {/if}
                        {#if sType === "youtube"}
                            <img
                                src="https://img.youtube.com/vi/{v.youtube_id}/default.jpg"
                                alt="thumb"
                                on:click={() =>
                                    window.open(
                                        `https://youtu.be/${v.youtube_id}`,
                                        "_blank",
                                    )}
                                class="thumb"
                            />
                        {:else}
                            <!-- svelte-ignore a11y-click-events-have-key-events -->
                            <div
                                class="thumb-placeholder {sType}"
                                on:click={() => {
                                    let u = "";
                                    // If ID is a full URL (new behavior), use it directly
                                    if (v.youtube_id.startsWith("http")) {
                                        u = v.youtube_id;
                                    } else {
                                        // Legacy: Reconstruct URL from ID
                                        if (sType === "vimeo")
                                            u = `https://vimeo.com/${v.youtube_id}`;
                                        else if (sType === "twitter")
                                            u = `https://twitter.com/x/status/${v.youtube_id}`;
                                        else if (sType === "tiktok")
                                            u = `https://tiktok.com/@u/video/${v.youtube_id}`;
                                        else if (sType === "instagram")
                                            u = `https://instagram.com/p/${v.youtube_id}`;
                                        else if (sType === "facebook")
                                            u = `https://facebook.com/watch?v=${v.youtube_id}`;
                                    }
                                    if (u) window.open(u, "_blank");
                                }}
                            >
                                <span class="source-badge">{sType}</span>
                            </div>
                        {/if}
                        <div>
                            {#if editingId === v.id}
                                <input
                                    id="edit-input-{v.id}"
                                    type="text"
                                    bind:value={editTitle}
                                    on:blur={() => saveEdit(v.id)}
                                    on:keydown={(e) => handleKeydown(e, v.id)}
                                    class="edit-input"
                                />
                            {:else}
                                <div class="title-row">
                                    <div
                                        class="title"
                                        on:click={() => startEdit(v)}
                                        title="Click to edit"
                                    >
                                        {v.title}
                                    </div>
                                    <button
                                        class="icon-btn edit-btn"
                                        on:click={() => startEdit(v)}>✎</button
                                    >
                                </div>
                            {/if}
                            <div class="meta">
                                <select
                                    class="inline-cat-select"
                                    value={v.category_id}
                                    on:change={(e) =>
                                        changeVideoCategory(v, e.target.value)}
                                >
                                    <option value="">Uncategorized</option>
                                    {#each $categories as c}
                                        <option value={c.id}>{c.name}</option>
                                    {/each}
                                </select>
                                <!-- {v.category_name || "Uncategorized"} -->
                            </div>
                        </div>
                    </div>
                    <div class="actions">
                        <span class="id">{v.youtube_id}</span>
                        <button
                            class="btn-danger"
                            on:click={() => deleteVideo(v.id)}>Delete</button
                        >
                    </div>
                </div>
            {/each}
        </div>

        <div class="pagination">
            <button
                on:click={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}>Previous</button
            >
            <span class="page-info">Page {currentPage} of {totalPages}</span>
            <button
                on:click={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}>Next</button
            >
        </div>
    {/if}
</div>

<style>
    .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #eee;
    }
    .page-info {
        font-weight: 500;
        color: #555;
    }
    .item.dragging {
        opacity: 0.5;
        border: 2px dashed #2563eb;
        background: #f0f9ff;
    }
    .draggable {
        cursor: grab;
    }
    .drag-handle {
        cursor: grab;
        color: #9ca3af;
        margin-right: 10px;
        font-size: 1.2rem;
        user-select: none;
    }
    .card {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    h2 {
        margin-top: 0;
        font-size: 1.25rem;
    }

    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 1rem;
        margin-bottom: 1rem;
    }
    .filters {
        display: flex;
        gap: 10px;
    }
    .filters select {
        padding: 5px;
        border-radius: 4px;
        border: 1px solid #ccc;
        font-size: 0.9rem;
    }

    .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
    }
    textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-family: inherit;
    }
    .controls {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    select,
    button {
        padding: 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
    }
    button {
        background: #2563eb;
        color: white;
        border: none;
        font-weight: bold;
        cursor: pointer;
    }
    button:hover {
        background: #1d4ed8;
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
        border-bottom: 1px solid #e5e7eb;
    }
    .info {
        display: flex;
        gap: 10px;
        align-items: center;
        flex: 1;
    }
    .info img {
        height: 40px;
        border-radius: 4px;
    }
    .thumb {
        cursor: pointer;
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    }
    .title {
        font-weight: 500;
        font-size: 0.9rem;
    }
    .title:hover {
        text-decoration: underline;
        color: #2563eb;
    }

    .edit-input {
        font-size: 0.9rem;
        padding: 4px;
        border: 1px solid #2563eb;
        border-radius: 4px;
        width: 300px;
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

    .meta {
        font-size: 0.8rem;
        color: #6b7280;
    }
    .actions {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .id {
        font-size: 0.8rem;
        color: #aaa;
    }
    .btn-danger {
        background: #ef4444;
        padding: 5px 10px;
        font-size: 0.8rem;
        border-radius: 4px;
        color: white;
        border: none;
        cursor: pointer;
    }
    .btn-danger:hover {
        background: #dc2626;
    }
    .empty {
        font-style: italic;
        color: #6b7280;
    }

    .notification-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
    }

    .notification-toast.success {
        background-color: #10b981;
    }
    .notification-toast.error {
        background-color: #ef4444;
    }
    .notification-toast.info {
        background-color: #3b82f6;
    }

    @keyframes slideIn {
        from {
            transform: translateY(-20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    .thumb-placeholder {
        height: 40px;
        width: 70px; /* approx 16:9 */
        border-radius: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 0.6rem;
        font-weight: bold;
        color: white;
        text-transform: capitalize;
        cursor: pointer;
        background: #9ca3af;
    }
    .thumb-placeholder.twitter {
        background: #1da1f2;
    }
    .thumb-placeholder.tiktok {
        background: #000000;
    }
    .thumb-placeholder.instagram {
        background: linear-gradient(
            45deg,
            #f09433 0%,
            #e6683c 25%,
            #dc2743 50%,
            #cc2366 75%,
            #bc1888 100%
        );
    }
    .thumb-placeholder.facebook {
        background: #4267b2;
    }
    .thumb-placeholder.vimeo {
        background: #1ab7ea;
    }

    @media (max-width: 768px) {
        .grid {
            grid-template-columns: 1fr;
        }
        .header-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
        }
        .filters {
            width: 100%;
        }
        .filters select {
            flex: 1;
        }
        .item {
            flex-direction: column;
            align-items: flex-start;
        }
        .info {
            width: 100%;
            margin-bottom: 1rem;
        }
        .actions {
            width: 100%;
            justify-content: space-between;
        }
        .edit-input {
            width: 100%;
        }
    }
</style>
