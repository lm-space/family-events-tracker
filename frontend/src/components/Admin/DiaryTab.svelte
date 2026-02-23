<script lang="ts">
    import { onMount } from "svelte";
    import {
        notes,
        people,
        tags,
        diaryCategories,
        fetchNotes,
        fetchPeople,
        fetchTags,
        fetchDiaryCategories,
        searchDiary,
        API_BASE,
    } from "../../lib/stores";

    // State
    let selectedNote: any = null;
    let isCreating = false;
    let isEditing = false;
    let showPeopleModal = false;
    let showTagsModal = false;
    let searchQuery = "";
    let searchResults: any = null;

    // Filters
    let filterCategory = "";
    let filterPerson = "";
    let filterTag = "";
    let filterImportance = "";

    // Form data
    let formData = {
        title: "",
        content: "",
        category: "General",
        importance: "Low",
        event_date: "",
        people: [] as { id: number; name: string; role: string }[],
        tags: [] as number[],
    };

    // People form
    let newPerson = { name: "", relationship: "", notes: "" };
    let editingPerson: any = null;

    // Tags form
    let newTag = { name: "", color: "#3b82f6" };

    // Photo upload
    let photoInput: HTMLInputElement;
    let uploadingPhoto = false;

    const categoryOptions = [
        "Health",
        "Medical",
        "Prescription",
        "Appointment",
        "Personal",
        "Family",
        "Work",
        "Financial",
        "General",
        "Other",
    ];

    const importanceOptions = ["Low", "Medium", "High"];

    const relationshipOptions = [
        "Self",
        "Spouse",
        "Child",
        "Parent",
        "Sibling",
        "Grandparent",
        "Friend",
        "Other",
    ];

    onMount(() => {
        loadData();
    });

    async function loadData() {
        await Promise.all([
            fetchNotes(),
            fetchPeople(),
            fetchTags(),
            fetchDiaryCategories(),
        ]);
    }

    async function applyFilters() {
        const filters: Record<string, string> = {};
        if (filterCategory) filters.category = filterCategory;
        if (filterPerson) filters.person_id = filterPerson;
        if (filterTag) filters.tag_id = filterTag;
        if (filterImportance) filters.importance = filterImportance;
        await fetchNotes(Object.keys(filters).length > 0 ? filters : undefined);
    }

    async function handleSearch() {
        if (searchQuery.length < 2) {
            searchResults = null;
            return;
        }
        searchResults = await searchDiary(searchQuery);
    }

    function clearSearch() {
        searchQuery = "";
        searchResults = null;
    }

    function clearFilters() {
        filterCategory = "";
        filterPerson = "";
        filterTag = "";
        filterImportance = "";
        fetchNotes();
    }

    function openNote(note: any) {
        selectedNote = note;
        isEditing = false;
    }

    function closeNote() {
        selectedNote = null;
        isEditing = false;
    }

    function startCreate() {
        formData = {
            title: "",
            content: "",
            category: "General",
            importance: "Low",
            event_date: new Date().toISOString().split("T")[0],
            people: [],
            tags: [],
        };
        isCreating = true;
    }

    function startEdit() {
        if (!selectedNote) return;
        formData = {
            title: selectedNote.title || "",
            content: selectedNote.content || "",
            category: selectedNote.category || "General",
            importance: selectedNote.importance || "Low",
            event_date: selectedNote.event_date || "",
            people: (selectedNote.people || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                role: p.role || "",
            })),
            tags: (selectedNote.tags || []).map((t: any) => t.id),
        };
        isEditing = true;
    }

    function cancelEdit() {
        isCreating = false;
        isEditing = false;
    }

    async function saveNote() {
        const payload = {
            ...formData,
            people: formData.people.map((p) => ({ id: p.id, role: p.role })),
        };

        try {
            let res;
            if (isCreating) {
                res = await fetch(`${API_BASE}/notes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else if (isEditing && selectedNote) {
                res = await fetch(`${API_BASE}/notes/${selectedNote.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            if (res?.ok) {
                await fetchNotes();
                if (isEditing && selectedNote) {
                    const updatedRes = await fetch(
                        `${API_BASE}/notes/${selectedNote.id}`,
                    );
                    if (updatedRes.ok) {
                        selectedNote = await updatedRes.json();
                    }
                }
                isCreating = false;
                isEditing = false;
            }
        } catch (e) {
            console.error("Failed to save note", e);
        }
    }

    async function deleteNote() {
        if (!selectedNote || !confirm("Delete this note?")) return;
        try {
            await fetch(`${API_BASE}/notes/${selectedNote.id}`, {
                method: "DELETE",
            });
            await fetchNotes();
            closeNote();
        } catch (e) {
            console.error("Failed to delete note", e);
        }
    }

    // Photo handling
    async function uploadPhoto() {
        if (!selectedNote || !photoInput?.files?.length) return;
        uploadingPhoto = true;

        const file = photoInput.files[0];
        const formData = new FormData();
        formData.append("photo", file);

        try {
            const res = await fetch(
                `${API_BASE}/notes/${selectedNote.id}/photos`,
                {
                    method: "POST",
                    body: formData,
                },
            );
            if (res.ok) {
                const updated = await fetch(
                    `${API_BASE}/notes/${selectedNote.id}`,
                );
                if (updated.ok) {
                    selectedNote = await updated.json();
                }
            }
        } catch (e) {
            console.error("Upload failed", e);
        }
        uploadingPhoto = false;
        photoInput.value = "";
    }

    async function deletePhoto(photoId: number) {
        if (!confirm("Delete this photo?")) return;
        try {
            await fetch(`${API_BASE}/photos/${photoId}`, {
                method: "DELETE",
            });
            const updated = await fetch(
                `${API_BASE}/notes/${selectedNote.id}`,
            );
            if (updated.ok) {
                selectedNote = await updated.json();
            }
        } catch (e) {
            console.error("Delete photo failed", e);
        }
    }

    // People management
    async function savePerson() {
        if (!newPerson.name) return;
        try {
            if (editingPerson) {
                await fetch(`${API_BASE}/people/${editingPerson.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newPerson),
                });
            } else {
                await fetch(`${API_BASE}/people`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newPerson),
                });
            }
            await fetchPeople();
            newPerson = { name: "", relationship: "", notes: "" };
            editingPerson = null;
        } catch (e) {
            console.error("Failed to save person", e);
        }
    }

    async function deletePerson(id: number) {
        if (!confirm("Delete this person?")) return;
        try {
            await fetch(`${API_BASE}/people/${id}`, { method: "DELETE" });
            await fetchPeople();
        } catch (e) {
            console.error("Failed to delete person", e);
        }
    }

    function editPerson(person: any) {
        editingPerson = person;
        newPerson = {
            name: person.name,
            relationship: person.relationship || "",
            notes: person.notes || "",
        };
    }

    // Tags management
    async function saveTag() {
        if (!newTag.name) return;
        try {
            await fetch(`${API_BASE}/tags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTag),
            });
            await fetchTags();
            newTag = { name: "", color: "#3b82f6" };
        } catch (e) {
            console.error("Failed to save tag", e);
        }
    }

    async function deleteTag(id: number) {
        if (!confirm("Delete this tag?")) return;
        try {
            await fetch(`${API_BASE}/tags/${id}`, { method: "DELETE" });
            await fetchTags();
        } catch (e) {
            console.error("Failed to delete tag", e);
        }
    }

    // Form helpers
    function togglePersonInForm(person: any) {
        const idx = formData.people.findIndex((p) => p.id === person.id);
        if (idx >= 0) {
            formData.people = formData.people.filter((p) => p.id !== person.id);
        } else {
            formData.people = [
                ...formData.people,
                { id: person.id, name: person.name, role: "" },
            ];
        }
    }

    function toggleTagInForm(tagId: number) {
        if (formData.tags.includes(tagId)) {
            formData.tags = formData.tags.filter((t) => t !== tagId);
        } else {
            formData.tags = [...formData.tags, tagId];
        }
    }

    function getPhotoUrl(url: string) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return `${API_BASE}${url}`;
    }

    function formatDate(dateStr: string) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString();
    }
</script>

<div class="diary-container">
    <!-- Header with search and filters -->
    <div class="diary-header">
        <div class="header-top">
            <h2>Personal Diary</h2>
            <div class="header-actions">
                <button class="btn-icon" on:click={() => (showPeopleModal = true)} title="Manage People">
                    <span>People</span>
                </button>
                <button class="btn-icon" on:click={() => (showTagsModal = true)} title="Manage Tags">
                    <span>Tags</span>
                </button>
                <button class="btn-primary" on:click={startCreate}>
                    + New Note
                </button>
            </div>
        </div>

        <!-- Search bar -->
        <div class="search-bar">
            <input
                type="text"
                placeholder="Search notes..."
                bind:value={searchQuery}
                on:input={handleSearch}
            />
            {#if searchQuery}
                <button class="clear-btn" on:click={clearSearch}>Clear</button>
            {/if}
        </div>

        <!-- Filters -->
        <div class="filters-row">
            <select bind:value={filterCategory} on:change={applyFilters}>
                <option value="">All Categories</option>
                {#each categoryOptions as cat}
                    <option value={cat}>{cat}</option>
                {/each}
            </select>

            <select bind:value={filterPerson} on:change={applyFilters}>
                <option value="">All People</option>
                {#each $people as person}
                    <option value={person.id}>{person.name}</option>
                {/each}
            </select>

            <select bind:value={filterTag} on:change={applyFilters}>
                <option value="">All Tags</option>
                {#each $tags as tag}
                    <option value={tag.id}>{tag.name}</option>
                {/each}
            </select>

            <select bind:value={filterImportance} on:change={applyFilters}>
                <option value="">Any Importance</option>
                {#each importanceOptions as imp}
                    <option value={imp}>{imp}</option>
                {/each}
            </select>

            {#if filterCategory || filterPerson || filterTag || filterImportance}
                <button class="clear-filters" on:click={clearFilters}>Clear Filters</button>
            {/if}
        </div>
    </div>

    <!-- Search Results -->
    {#if searchResults}
        <div class="search-results">
            <h3>Search Results for "{searchQuery}"</h3>
            {#if searchResults.notes.length === 0 && searchResults.people.length === 0}
                <p class="no-results">No results found.</p>
            {:else}
                {#if searchResults.notes.length > 0}
                    <div class="result-section">
                        <h4>Notes ({searchResults.notes.length})</h4>
                        {#each searchResults.notes as note}
                            <div class="result-item" on:click={() => openNote(note)} on:keypress={() => openNote(note)} role="button" tabindex="0">
                                <strong>{note.title || "Untitled"}</strong>
                                <p>{note.content.substring(0, 100)}...</p>
                            </div>
                        {/each}
                    </div>
                {/if}
                {#if searchResults.people.length > 0}
                    <div class="result-section">
                        <h4>People ({searchResults.people.length})</h4>
                        {#each searchResults.people as person}
                            <div class="result-item">
                                <strong>{person.name}</strong>
                                <span class="relationship">{person.relationship || ""}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    {:else}
        <!-- Notes List -->
        <div class="notes-list">
            {#each $notes as note (note.id)}
                <div class="note-card" on:click={() => openNote(note)} on:keypress={() => openNote(note)} role="button" tabindex="0">
                    <div class="note-header">
                        <span class="note-date">{formatDate(note.event_date) || formatDate(note.created_at)}</span>
                        <span class="note-category badge-{note.category?.toLowerCase()}">{note.category}</span>
                    </div>
                    <h3 class="note-title">{note.title || "Untitled"}</h3>
                    <p class="note-preview">{note.content.substring(0, 150)}{note.content.length > 150 ? "..." : ""}</p>
                    <div class="note-meta">
                        {#if note.people?.length > 0}
                            <div class="meta-people">
                                {#each note.people.slice(0, 3) as person}
                                    <span class="person-chip">{person.name}</span>
                                {/each}
                                {#if note.people.length > 3}
                                    <span class="more">+{note.people.length - 3}</span>
                                {/if}
                            </div>
                        {/if}
                        {#if note.tags?.length > 0}
                            <div class="meta-tags">
                                {#each note.tags.slice(0, 3) as tag}
                                    <span class="tag-chip" style="background-color: {tag.color}20; color: {tag.color}">{tag.name}</span>
                                {/each}
                            </div>
                        {/if}
                        {#if note.photos?.length > 0}
                            <span class="photo-indicator">Images: {note.photos.length}</span>
                        {/if}
                        {#if note.importance === "High"}
                            <span class="importance-badge high">!</span>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="empty-state">
                    <p>No diary entries yet.</p>
                    <button class="btn-primary" on:click={startCreate}>Create your first note</button>
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- Note Detail/Edit Modal -->
{#if selectedNote || isCreating}
    <div class="modal-backdrop" on:click={() => { closeNote(); cancelEdit(); }} on:keypress={() => { closeNote(); cancelEdit(); }} role="button" tabindex="0">
        <div class="modal-content large" on:click|stopPropagation on:keypress|stopPropagation role="dialog">
            <div class="modal-header">
                <h3>
                    {#if isCreating}New Note{:else if isEditing}Edit Note{:else}Note Details{/if}
                </h3>
                <button class="close-btn" on:click={() => { closeNote(); cancelEdit(); }}>x</button>
            </div>

            <div class="modal-body">
                {#if isCreating || isEditing}
                    <!-- Edit Form -->
                    <div class="form-group">
                        <label for="title">Title</label>
                        <input id="title" type="text" bind:value={formData.title} placeholder="Optional title..." />
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="event_date">Event Date</label>
                            <input id="event_date" type="date" bind:value={formData.event_date} />
                        </div>
                        <div class="form-group">
                            <label for="category">Category</label>
                            <select id="category" bind:value={formData.category}>
                                {#each categoryOptions as cat}
                                    <option value={cat}>{cat}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="importance">Importance</label>
                            <select id="importance" bind:value={formData.importance}>
                                {#each importanceOptions as imp}
                                    <option value={imp}>{imp}</option>
                                {/each}
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="content">Content *</label>
                        <textarea id="content" bind:value={formData.content} rows="6" placeholder="Write your note here..."></textarea>
                    </div>

                    <!-- People Selection -->
                    <div class="form-group">
                        <label>Associated People</label>
                        <div class="selection-grid">
                            {#each $people as person}
                                <button
                                    type="button"
                                    class="selection-chip"
                                    class:selected={formData.people.some(p => p.id === person.id)}
                                    on:click={() => togglePersonInForm(person)}
                                >
                                    {person.name}
                                </button>
                            {/each}
                        </div>
                        {#if formData.people.length > 0}
                            <div class="selected-people">
                                {#each formData.people as person}
                                    <div class="person-role-row">
                                        <span>{person.name}</span>
                                        <input type="text" placeholder="Role (e.g., patient)" bind:value={person.role} />
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Tags Selection -->
                    <div class="form-group">
                        <label>Tags</label>
                        <div class="selection-grid">
                            {#each $tags as tag}
                                <button
                                    type="button"
                                    class="selection-chip tag-selection"
                                    class:selected={formData.tags.includes(tag.id)}
                                    style="--tag-color: {tag.color}"
                                    on:click={() => toggleTagInForm(tag.id)}
                                >
                                    {tag.name}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="form-actions">
                        <button class="btn-secondary" on:click={cancelEdit}>Cancel</button>
                        <button class="btn-primary" on:click={saveNote} disabled={!formData.content}>Save Note</button>
                    </div>
                {:else}
                    <!-- View Mode -->
                    <div class="note-detail">
                        <div class="detail-header">
                            <div class="detail-meta">
                                <span class="date">{formatDate(selectedNote.event_date) || formatDate(selectedNote.created_at)}</span>
                                <span class="badge badge-{selectedNote.category?.toLowerCase()}">{selectedNote.category}</span>
                                <span class="badge importance-{selectedNote.importance?.toLowerCase()}">{selectedNote.importance}</span>
                            </div>
                            <h2>{selectedNote.title || "Untitled"}</h2>
                        </div>

                        <div class="detail-content">
                            <p>{selectedNote.content}</p>
                        </div>

                        {#if selectedNote.people?.length > 0}
                            <div class="detail-section">
                                <h4>People</h4>
                                <div class="people-list">
                                    {#each selectedNote.people as person}
                                        <div class="person-item">
                                            <span class="name">{person.name}</span>
                                            {#if person.role}
                                                <span class="role">({person.role})</span>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        {#if selectedNote.tags?.length > 0}
                            <div class="detail-section">
                                <h4>Tags</h4>
                                <div class="tags-list">
                                    {#each selectedNote.tags as tag}
                                        <span class="tag-chip" style="background-color: {tag.color}20; color: {tag.color}">{tag.name}</span>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- Photos Section -->
                        <div class="detail-section">
                            <h4>Photos</h4>
                            {#if selectedNote.photos?.length > 0}
                                <div class="photos-grid">
                                    {#each selectedNote.photos as photo}
                                        <div class="photo-item">
                                            <img src={getPhotoUrl(photo.photo_url)} alt={photo.file_name || "Photo"} />
                                            <button class="delete-photo" on:click={() => deletePhoto(photo.id)}>x</button>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                            <div class="photo-upload">
                                <input type="file" accept="image/*" bind:this={photoInput} on:change={uploadPhoto} />
                                {#if uploadingPhoto}
                                    <span>Uploading...</span>
                                {/if}
                            </div>
                        </div>

                        <div class="detail-actions">
                            <button class="btn-secondary" on:click={startEdit}>Edit</button>
                            <button class="btn-danger" on:click={deleteNote}>Delete</button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<!-- People Management Modal -->
{#if showPeopleModal}
    <div class="modal-backdrop" on:click={() => (showPeopleModal = false)} on:keypress={() => (showPeopleModal = false)} role="button" tabindex="0">
        <div class="modal-content" on:click|stopPropagation on:keypress|stopPropagation role="dialog">
            <div class="modal-header">
                <h3>Manage People</h3>
                <button class="close-btn" on:click={() => (showPeopleModal = false)}>x</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <input type="text" placeholder="Name" bind:value={newPerson.name} />
                    <select bind:value={newPerson.relationship}>
                        <option value="">Relationship</option>
                        {#each relationshipOptions as rel}
                            <option value={rel}>{rel}</option>
                        {/each}
                    </select>
                    <button class="btn-primary" on:click={savePerson}>
                        {editingPerson ? "Update" : "Add"}
                    </button>
                </div>
                <input type="text" placeholder="Notes about this person" bind:value={newPerson.notes} class="full-width" />

                <div class="people-management-list">
                    {#each $people as person}
                        <div class="people-item">
                            <div class="info">
                                <strong>{person.name}</strong>
                                <span>{person.relationship || ""}</span>
                            </div>
                            <div class="actions">
                                <button on:click={() => editPerson(person)}>Edit</button>
                                <button class="danger" on:click={() => deletePerson(person.id)}>Delete</button>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Tags Management Modal -->
{#if showTagsModal}
    <div class="modal-backdrop" on:click={() => (showTagsModal = false)} on:keypress={() => (showTagsModal = false)} role="button" tabindex="0">
        <div class="modal-content" on:click|stopPropagation on:keypress|stopPropagation role="dialog">
            <div class="modal-header">
                <h3>Manage Tags</h3>
                <button class="close-btn" on:click={() => (showTagsModal = false)}>x</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <input type="text" placeholder="Tag name" bind:value={newTag.name} />
                    <input type="color" bind:value={newTag.color} />
                    <button class="btn-primary" on:click={saveTag}>Add</button>
                </div>

                <div class="tags-management-list">
                    {#each $tags as tag}
                        <div class="tag-item">
                            <span class="tag-chip" style="background-color: {tag.color}20; color: {tag.color}">{tag.name}</span>
                            <button class="danger" on:click={() => deleteTag(tag.id)}>Delete</button>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .diary-container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 20px;
    }

    .diary-header {
        margin-bottom: 24px;
    }

    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .header-top h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #1e293b;
    }

    .header-actions {
        display: flex;
        gap: 8px;
    }

    .btn-icon {
        padding: 8px 16px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-size: 0.9rem;
        color: #64748b;
    }

    .btn-icon:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
    }

    .btn-primary {
        padding: 8px 16px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
    }

    .btn-primary:hover {
        background: #2563eb;
    }

    .btn-primary:disabled {
        background: #94a3b8;
        cursor: not-allowed;
    }

    .btn-secondary {
        padding: 8px 16px;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
    }

    .btn-danger {
        padding: 8px 16px;
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
        border-radius: 8px;
        cursor: pointer;
    }

    .search-bar {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }

    .search-bar input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.95rem;
    }

    .clear-btn {
        padding: 8px 16px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
    }

    .filters-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .filters-row select {
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: white;
        font-size: 0.9rem;
        color: #475569;
    }

    .clear-filters {
        padding: 8px 12px;
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    /* Notes List */
    .notes-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
    }

    .note-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .note-card:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        transform: translateY(-2px);
    }

    .note-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .note-date {
        font-size: 0.8rem;
        color: #64748b;
    }

    .note-category {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 4px;
        background: #f1f5f9;
        color: #475569;
    }

    .badge-health, .badge-medical { background: #fef2f2; color: #dc2626; }
    .badge-prescription { background: #fff7ed; color: #ea580c; }
    .badge-appointment { background: #fefce8; color: #ca8a04; }
    .badge-family, .badge-personal { background: #f0fdf4; color: #16a34a; }
    .badge-work { background: #eff6ff; color: #2563eb; }
    .badge-financial { background: #faf5ff; color: #9333ea; }

    .note-title {
        margin: 0 0 8px;
        font-size: 1.1rem;
        color: #1e293b;
    }

    .note-preview {
        margin: 0;
        font-size: 0.9rem;
        color: #64748b;
        line-height: 1.5;
    }

    .note-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
        align-items: center;
    }

    .person-chip {
        font-size: 0.75rem;
        padding: 2px 8px;
        background: #e0f2fe;
        color: #0369a1;
        border-radius: 12px;
    }

    .tag-chip {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 12px;
    }

    .photo-indicator {
        font-size: 0.75rem;
        color: #64748b;
    }

    .importance-badge.high {
        background: #fef2f2;
        color: #dc2626;
        font-weight: bold;
        padding: 2px 8px;
        border-radius: 4px;
    }

    .more {
        font-size: 0.75rem;
        color: #64748b;
    }

    .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
        color: #64748b;
    }

    /* Search Results */
    .search-results {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
    }

    .search-results h3 {
        margin: 0 0 16px;
        color: #1e293b;
    }

    .result-section {
        margin-bottom: 20px;
    }

    .result-section h4 {
        margin: 0 0 8px;
        color: #64748b;
        font-size: 0.9rem;
    }

    .result-item {
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
    }

    .result-item:hover {
        background: #f8fafc;
    }

    .result-item p {
        margin: 4px 0 0;
        font-size: 0.85rem;
        color: #64748b;
    }

    .relationship {
        font-size: 0.85rem;
        color: #64748b;
        margin-left: 8px;
    }

    .no-results {
        color: #64748b;
        font-style: italic;
    }

    /* Modal Styles */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(2px);
    }

    .modal-content {
        background: white;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        border-radius: 12px;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    .modal-content.large {
        max-width: 700px;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h3 {
        margin: 0;
        color: #1e293b;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #64748b;
        line-height: 1;
    }

    .modal-body {
        padding: 20px;
    }

    /* Form Styles */
    .form-group {
        margin-bottom: 16px;
    }

    .form-group label {
        display: block;
        margin-bottom: 6px;
        font-size: 0.9rem;
        color: #475569;
        font-weight: 500;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.95rem;
        box-sizing: border-box;
    }

    .form-group textarea {
        resize: vertical;
        min-height: 100px;
    }

    .form-row {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
    }

    .form-row .form-group {
        flex: 1;
        margin-bottom: 0;
    }

    .form-row input,
    .form-row select {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
    }

    .full-width {
        width: 100%;
        margin-top: 8px;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
    }

    .selection-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .selection-chip {
        padding: 6px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        background: white;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s;
    }

    .selection-chip:hover {
        background: #f8fafc;
    }

    .selection-chip.selected {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
    }

    .selection-chip.tag-selection.selected {
        background: var(--tag-color);
        border-color: var(--tag-color);
    }

    .selected-people {
        margin-top: 12px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
    }

    .person-role-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    .person-role-row span {
        min-width: 100px;
        font-weight: 500;
    }

    .person-role-row input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 0.85rem;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
    }

    /* Note Detail View */
    .note-detail .detail-header {
        margin-bottom: 20px;
    }

    .detail-meta {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
    }

    .detail-meta .date {
        font-size: 0.85rem;
        color: #64748b;
    }

    .detail-meta .badge {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 4px;
    }

    .importance-low { background: #f0fdf4; color: #16a34a; }
    .importance-medium { background: #fff7ed; color: #ea580c; }
    .importance-high { background: #fef2f2; color: #dc2626; }

    .note-detail h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #1e293b;
    }

    .detail-content {
        background: #f8fafc;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 20px;
    }

    .detail-content p {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.6;
        color: #334155;
    }

    .detail-section {
        margin-bottom: 20px;
    }

    .detail-section h4 {
        margin: 0 0 8px;
        font-size: 0.85rem;
        color: #64748b;
        text-transform: uppercase;
    }

    .people-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .person-item {
        padding: 6px 12px;
        background: #e0f2fe;
        border-radius: 20px;
    }

    .person-item .name {
        color: #0369a1;
        font-weight: 500;
    }

    .person-item .role {
        color: #64748b;
        font-size: 0.85rem;
        margin-left: 4px;
    }

    .tags-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    /* Photos */
    .photos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 12px;
    }

    .photo-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
    }

    .photo-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .delete-photo {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        background: rgba(220, 38, 38, 0.9);
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
    }

    .photo-upload input {
        font-size: 0.9rem;
    }

    .detail-actions {
        display: flex;
        gap: 8px;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
    }

    /* People/Tags Management */
    .people-management-list,
    .tags-management-list {
        margin-top: 20px;
    }

    .people-item,
    .tag-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 8px;
    }

    .people-item .info strong {
        display: block;
        color: #1e293b;
    }

    .people-item .info span {
        font-size: 0.85rem;
        color: #64748b;
    }

    .people-item .actions,
    .tag-item button {
        display: flex;
        gap: 8px;
    }

    .people-item button,
    .tag-item button {
        padding: 4px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 0.85rem;
    }

    .people-item button.danger,
    .tag-item button.danger {
        background: #fef2f2;
        color: #dc2626;
        border-color: #fecaca;
    }

    .meta-people,
    .meta-tags {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }
</style>
