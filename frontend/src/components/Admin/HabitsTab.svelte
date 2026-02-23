<script lang="ts">
    import { onMount } from "svelte";
    import {
        people,
        fetchPeople,
        fetchFamilyHabitsSummary,
        familyHabitsSummary,
        toggleHabit,
        initDefaultHabits,
        addHabitNote,
        API_BASE,
    } from "../../lib/stores";

    // State
    let selectedPerson: any = null;
    let personHabits: any[] = [];
    let habitStats: any[] = [];
    let selectedDate = new Date().toISOString().split("T")[0];
    let showAddHabitModal = false;
    let showHabitNoteModal = false;
    let selectedHabitForNote: any = null;
    let habitNoteText = "";
    let showPersonModal = false;
    let loading = false;

    // New habit form
    let newHabit = {
        name: "",
        description: "",
        icon: "✓",
        color: "#3b82f6",
    };

    // New person form
    let newPerson = {
        name: "",
        relationship: "",
    };

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

    const habitIcons = [
        "✓", "💊", "❤️", "🩸", "🏃", "💧", "🥗", "😴", "💎", "🧘",
        "📖", "🎯", "💪", "🚶", "🍎", "☀️", "🌙", "🧠", "🎵", "🙏"
    ];

    onMount(() => {
        loadData();
    });

    async function loadData() {
        await fetchPeople();
        await fetchFamilyHabitsSummary();
    }

    async function selectPerson(person: any) {
        selectedPerson = person;
        loading = true;
        await loadPersonHabits();
        await loadHabitStats();
        loading = false;
    }

    async function loadPersonHabits() {
        if (!selectedPerson) return;
        try {
            const res = await fetch(
                `${API_BASE}/people/${selectedPerson.id}/habits/today`
            );
            if (res.ok) {
                personHabits = await res.json();
            }
        } catch (e) {
            console.error("Failed to load habits", e);
        }
    }

    async function loadHabitStats() {
        if (!selectedPerson) return;
        try {
            const res = await fetch(
                `${API_BASE}/people/${selectedPerson.id}/habit-stats?days=30`
            );
            if (res.ok) {
                habitStats = await res.json();
            }
        } catch (e) {
            console.error("Failed to load stats", e);
        }
    }

    async function handleToggleHabit(habit: any) {
        const result = await toggleHabit(habit.id, selectedDate);
        if (result) {
            await loadPersonHabits();
            await fetchFamilyHabitsSummary();
        }
    }

    async function handleInitDefaults() {
        if (!selectedPerson) return;
        const result = await initDefaultHabits(selectedPerson.id);
        if (result) {
            await loadPersonHabits();
            await loadHabitStats();
        }
    }

    function openNoteModal(habit: any) {
        selectedHabitForNote = habit;
        habitNoteText = habit.note || "";
        showHabitNoteModal = true;
    }

    async function saveHabitNote() {
        if (!selectedHabitForNote) return;
        await addHabitNote(selectedHabitForNote.id, habitNoteText, selectedDate);
        showHabitNoteModal = false;
        selectedHabitForNote = null;
        habitNoteText = "";
        await loadPersonHabits();
    }

    async function addNewHabit() {
        if (!selectedPerson || !newHabit.name) return;
        try {
            const res = await fetch(
                `${API_BASE}/people/${selectedPerson.id}/habits`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newHabit),
                }
            );
            if (res.ok) {
                showAddHabitModal = false;
                newHabit = { name: "", description: "", icon: "✓", color: "#3b82f6" };
                await loadPersonHabits();
                await loadHabitStats();
            }
        } catch (e) {
            console.error("Failed to add habit", e);
        }
    }

    async function deleteHabit(habitId: number) {
        if (!confirm("Delete this habit?")) return;
        try {
            await fetch(`${API_BASE}/habits/${habitId}`, {
                method: "DELETE",
            });
            await loadPersonHabits();
            await loadHabitStats();
        } catch (e) {
            console.error("Failed to delete habit", e);
        }
    }

    async function addNewPerson() {
        if (!newPerson.name) return;
        try {
            const res = await fetch(`${API_BASE}/people`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newPerson),
            });
            if (res.ok) {
                showPersonModal = false;
                newPerson = { name: "", relationship: "" };
                await fetchPeople();
                await fetchFamilyHabitsSummary();
            }
        } catch (e) {
            console.error("Failed to add person", e);
        }
    }

    function getCompletionColor(percentage: number) {
        if (percentage >= 80) return "#22c55e";
        if (percentage >= 50) return "#eab308";
        return "#ef4444";
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    }
</script>

<div class="habits-container">
    <!-- Header -->
    <div class="habits-header">
        <div class="header-left">
            <h2>Family Habit Tracker</h2>
            <p class="subtitle">Track daily habits for each family member</p>
        </div>
        <div class="header-right">
            <input type="date" bind:value={selectedDate} class="date-picker" />
            <button class="btn-primary" on:click={() => (showPersonModal = true)}>
                + Add Person
            </button>
        </div>
    </div>

    <!-- Family Overview -->
    <div class="family-grid">
        {#each $familyHabitsSummary as person (person.id)}
            <button
                class="person-card"
                class:selected={selectedPerson?.id === person.id}
                on:click={() => selectPerson(person)}
            >
                <div class="person-avatar" style="background-color: {getCompletionColor(person.completion_percentage)}">
                    {person.name.charAt(0).toUpperCase()}
                </div>
                <div class="person-info">
                    <h3>{person.name}</h3>
                    <span class="relationship">{person.relationship || "Family"}</span>
                </div>
                <div class="completion-ring">
                    <svg viewBox="0 0 36 36" class="circular-chart">
                        <path
                            class="circle-bg"
                            d="M18 2.0845
                               a 15.9155 15.9155 0 0 1 0 31.831
                               a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                            class="circle"
                            stroke-dasharray="{person.completion_percentage}, 100"
                            style="stroke: {getCompletionColor(person.completion_percentage)}"
                            d="M18 2.0845
                               a 15.9155 15.9155 0 0 1 0 31.831
                               a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <text x="18" y="20.35" class="percentage">{person.completion_percentage}%</text>
                    </svg>
                </div>
                <div class="habit-count">
                    {person.completed_habits}/{person.total_habits} done
                </div>
            </button>
        {:else}
            <div class="empty-family">
                <p>No family members yet.</p>
                <button class="btn-primary" on:click={() => (showPersonModal = true)}>
                    Add your first family member
                </button>
            </div>
        {/each}
    </div>

    <!-- Selected Person's Habits -->
    {#if selectedPerson}
        <div class="person-habits-section">
            <div class="section-header">
                <h3>{selectedPerson.name}'s Habits - {formatDate(selectedDate)}</h3>
                <div class="section-actions">
                    {#if personHabits.length === 0}
                        <button class="btn-secondary" on:click={handleInitDefaults}>
                            Load Default Habits
                        </button>
                    {/if}
                    <button class="btn-primary" on:click={() => (showAddHabitModal = true)}>
                        + Add Habit
                    </button>
                </div>
            </div>

            {#if loading}
                <div class="loading">Loading habits...</div>
            {:else if personHabits.length === 0}
                <div class="no-habits">
                    <p>No habits set up yet for {selectedPerson.name}.</p>
                    <p>Click "Load Default Habits" to add common daily habits, or add custom ones.</p>
                </div>
            {:else}
                <div class="habits-list">
                    {#each personHabits as habit (habit.id)}
                        <div class="habit-item" class:completed={habit.completed}>
                            <button
                                class="habit-checkbox"
                                style="background-color: {habit.completed ? habit.color : 'transparent'}; border-color: {habit.color}"
                                on:click={() => handleToggleHabit(habit)}
                            >
                                {#if habit.completed}
                                    <span class="check">✓</span>
                                {/if}
                            </button>
                            <div class="habit-icon" style="color: {habit.color}">{habit.icon}</div>
                            <div class="habit-content">
                                <h4>{habit.name}</h4>
                                {#if habit.description}
                                    <p class="description">{habit.description}</p>
                                {/if}
                                {#if habit.note || habit.transcription}
                                    <p class="note">{habit.note || habit.transcription}</p>
                                {/if}
                            </div>
                            <div class="habit-actions">
                                <button class="action-btn" on:click={() => openNoteModal(habit)} title="Add note">
                                    Note
                                </button>
                                <button class="action-btn danger" on:click={() => deleteHabit(habit.id)} title="Delete">
                                    x
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- Stats Section -->
            {#if habitStats.length > 0}
                <div class="stats-section">
                    <h4>30-Day Statistics</h4>
                    <div class="stats-grid">
                        {#each habitStats as stat}
                            <div class="stat-card">
                                <span class="stat-icon" style="color: {stat.color}">{stat.icon}</span>
                                <div class="stat-info">
                                    <span class="stat-name">{stat.name}</span>
                                    <div class="stat-details">
                                        <span class="streak">Streak: {stat.current_streak} days</span>
                                        <span class="rate">{Math.round((stat.completed_count / stat.total_days) * 100)}% rate</span>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {:else}
        <div class="select-person-prompt">
            <p>Select a family member above to view and track their habits</p>
        </div>
    {/if}
</div>

<!-- Add Person Modal -->
{#if showPersonModal}
    <div class="modal-backdrop" on:click={() => (showPersonModal = false)} on:keypress={() => (showPersonModal = false)} role="button" tabindex="0">
        <div class="modal-content" on:click|stopPropagation on:keypress|stopPropagation role="dialog" tabindex="0">
            <div class="modal-header">
                <h3>Add Family Member</h3>
                <button class="close-btn" on:click={() => (showPersonModal = false)}>x</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="personName">Name</label>
                    <input id="personName" type="text" bind:value={newPerson.name} placeholder="Enter name" />
                </div>
                <div class="form-group">
                    <label for="personRelationship">Relationship</label>
                    <select id="personRelationship" bind:value={newPerson.relationship}>
                        <option value="">Select relationship</option>
                        {#each relationshipOptions as rel}
                            <option value={rel}>{rel}</option>
                        {/each}
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" on:click={() => (showPersonModal = false)}>Cancel</button>
                    <button class="btn-primary" on:click={addNewPerson} disabled={!newPerson.name}>Add</button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Add Habit Modal -->
{#if showAddHabitModal}
    <div class="modal-backdrop" on:click={() => (showAddHabitModal = false)} on:keypress={() => (showAddHabitModal = false)} role="button" tabindex="0">
        <div class="modal-content" on:click|stopPropagation on:keypress|stopPropagation role="dialog" tabindex="0">
            <div class="modal-header">
                <h3>Add New Habit</h3>
                <button class="close-btn" on:click={() => (showAddHabitModal = false)}>x</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="habitName">Habit Name</label>
                    <input id="habitName" type="text" bind:value={newHabit.name} placeholder="e.g., Take vitamins" />
                </div>
                <div class="form-group">
                    <label for="habitDescription">Description (optional)</label>
                    <input id="habitDescription" type="text" bind:value={newHabit.description} placeholder="Brief description" />
                </div>
                <div class="form-group">
                    <label>Icon</label>
                    <div class="icon-picker">
                        {#each habitIcons as icon}
                            <button
                                type="button"
                                class="icon-option"
                                class:selected={newHabit.icon === icon}
                                on:click={() => (newHabit.icon = icon)}
                            >
                                {icon}
                            </button>
                        {/each}
                    </div>
                </div>
                <div class="form-group">
                    <label for="habitColor">Color</label>
                    <input id="habitColor" type="color" bind:value={newHabit.color} />
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" on:click={() => (showAddHabitModal = false)}>Cancel</button>
                    <button class="btn-primary" on:click={addNewHabit} disabled={!newHabit.name}>Add Habit</button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Habit Note Modal -->
{#if showHabitNoteModal && selectedHabitForNote}
    <div class="modal-backdrop" on:click={() => (showHabitNoteModal = false)} on:keypress={() => (showHabitNoteModal = false)} role="button" tabindex="0">
        <div class="modal-content" on:click|stopPropagation on:keypress|stopPropagation role="dialog" tabindex="0">
            <div class="modal-header">
                <h3>Add Note - {selectedHabitForNote.name}</h3>
                <button class="close-btn" on:click={() => (showHabitNoteModal = false)}>x</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="habitNote">Note</label>
                    <textarea id="habitNote" bind:value={habitNoteText} rows="4" placeholder="Add a note about this habit..."></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" on:click={() => (showHabitNoteModal = false)}>Cancel</button>
                    <button class="btn-primary" on:click={saveHabitNote}>Save Note</button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .habits-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }

    .habits-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24px;
    }

    .header-left h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #1e293b;
    }

    .subtitle {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 0.9rem;
    }

    .header-right {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .date-picker {
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.9rem;
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

    /* Family Grid */
    .family-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
    }

    .person-card {
        background: white;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;
    }

    .person-card:hover {
        border-color: #3b82f6;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }

    .person-card.selected {
        border-color: #3b82f6;
        background: #eff6ff;
    }

    .person-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.25rem;
        font-weight: bold;
    }

    .person-info h3 {
        margin: 0;
        font-size: 1rem;
        color: #1e293b;
    }

    .relationship {
        font-size: 0.8rem;
        color: #64748b;
    }

    .completion-ring {
        width: 60px;
        height: 60px;
    }

    .circular-chart {
        width: 100%;
        height: 100%;
    }

    .circle-bg {
        fill: none;
        stroke: #eee;
        stroke-width: 3.8;
    }

    .circle {
        fill: none;
        stroke-width: 3.8;
        stroke-linecap: round;
        animation: progress 1s ease-out forwards;
    }

    @keyframes progress {
        0% {
            stroke-dasharray: 0, 100;
        }
    }

    .percentage {
        fill: #1e293b;
        font-size: 0.35em;
        text-anchor: middle;
        font-weight: bold;
    }

    .habit-count {
        font-size: 0.8rem;
        color: #64748b;
    }

    .empty-family {
        grid-column: 1 / -1;
        text-align: center;
        padding: 40px;
        color: #64748b;
    }

    /* Person Habits Section */
    .person-habits-section {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .section-header h3 {
        margin: 0;
        color: #1e293b;
    }

    .section-actions {
        display: flex;
        gap: 8px;
    }

    .loading, .no-habits, .select-person-prompt {
        text-align: center;
        padding: 40px;
        color: #64748b;
    }

    /* Habits List */
    .habits-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .habit-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: #f8fafc;
        border-radius: 8px;
        transition: all 0.2s;
    }

    .habit-item.completed {
        background: #f0fdf4;
    }

    .habit-checkbox {
        width: 28px;
        height: 28px;
        border: 2px solid;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s;
    }

    .habit-checkbox .check {
        color: white;
        font-weight: bold;
    }

    .habit-icon {
        font-size: 1.5rem;
        width: 32px;
        text-align: center;
    }

    .habit-content {
        flex: 1;
    }

    .habit-content h4 {
        margin: 0;
        font-size: 1rem;
        color: #1e293b;
    }

    .habit-content .description {
        margin: 2px 0 0;
        font-size: 0.85rem;
        color: #64748b;
    }

    .habit-content .note {
        margin: 4px 0 0;
        font-size: 0.85rem;
        color: #3b82f6;
        font-style: italic;
    }

    .habit-actions {
        display: flex;
        gap: 4px;
    }

    .action-btn {
        padding: 4px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 0.8rem;
        color: #64748b;
    }

    .action-btn:hover {
        background: #f1f5f9;
    }

    .action-btn.danger {
        color: #dc2626;
        border-color: #fecaca;
    }

    .action-btn.danger:hover {
        background: #fef2f2;
    }

    /* Stats Section */
    .stats-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #e2e8f0;
    }

    .stats-section h4 {
        margin: 0 0 16px;
        color: #64748b;
        font-size: 0.9rem;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
    }

    .stat-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
    }

    .stat-icon {
        font-size: 1.5rem;
    }

    .stat-info {
        flex: 1;
    }

    .stat-name {
        display: block;
        font-size: 0.9rem;
        color: #1e293b;
        font-weight: 500;
    }

    .stat-details {
        display: flex;
        gap: 8px;
        font-size: 0.75rem;
        color: #64748b;
    }

    .streak {
        color: #22c55e;
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
    }

    .modal-content {
        background: white;
        width: 90%;
        max-width: 400px;
        border-radius: 12px;
        overflow: hidden;
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
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #64748b;
    }

    .modal-body {
        padding: 20px;
    }

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
    }

    .icon-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .icon-option {
        width: 40px;
        height: 40px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-size: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-option:hover {
        border-color: #3b82f6;
    }

    .icon-option.selected {
        border-color: #3b82f6;
        background: #eff6ff;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 20px;
    }
</style>
