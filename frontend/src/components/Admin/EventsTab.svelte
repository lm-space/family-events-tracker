<script lang="ts">
    import { events, API_BASE } from "../../lib/stores";

    let selectedEvent: any = null;
    let extractionData: any = null;
    let loadingExtraction = false;

    async function openEvent(e: any) {
        selectedEvent = e;
        extractionData = null;

        if (e.processed) {
            loadingExtraction = true;
            try {
                const res = await fetch(
                    `${API_BASE}/event-data?event_id=${e.id}`,
                );
                if (res.ok) {
                    const rows = await res.json();
                    if (rows && rows.length > 0) {
                        const data: any = {};
                        rows.forEach((r: any) => {
                            if (r.key === "entities" || r.key === "tags") {
                                try {
                                    data[r.key] = JSON.parse(r.value);
                                } catch (e) {
                                    data[r.key] = r.value;
                                }
                            } else {
                                data[r.key] = r.value;
                            }
                        });
                        extractionData = data;
                    }
                }
            } catch (e) {
                console.error(e);
            }
            loadingExtraction = false;
        }
    }

    function closeEvent() {
        selectedEvent = null;
        extractionData = null;
    }

    function getAudioSrc(url: string) {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return `${API_BASE}${url}`;
    }
</script>

<div class="events-container">
    <div class="header-row">
        <h2>Daily Life Recordings</h2>
    </div>

    <!-- List View -->
    <div class="event-list">
        {#each $events as event (event.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="event-row" on:click={() => openEvent(event)}>
                <div class="col-date">
                    <span class="day"
                        >{new Date(event.created_at).toLocaleDateString()}</span
                    >
                    <span class="time"
                        >{new Date(event.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}</span
                    >
                </div>
                <div class="col-preview">
                    {event.transcription
                        ? event.transcription.substring(0, 100) +
                          (event.transcription.length > 100 ? "..." : "")
                        : "No Text"}
                </div>
                <div class="col-status">
                    {#if event.processed}✅{:else}⏳{/if}
                </div>
            </div>
        {:else}
            <div class="empty-state">No recordings yet.</div>
        {/each}
    </div>
</div>

<!-- Modal -->
{#if selectedEvent}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-backdrop" on:click={closeEvent}>
        <div class="modal-content" on:click|stopPropagation>
            <div class="modal-header">
                <h3>Event #{selectedEvent.id}</h3>
                <button class="close-btn" on:click={closeEvent}>×</button>
            </div>

            <div class="modal-body">
                <div class="section audio-section">
                    <h4>🎧 Recording</h4>
                    <audio
                        controls
                        src={getAudioSrc(selectedEvent.audio_url)}
                        class="audio-player"
                    ></audio>
                </div>

                <div class="section text-section">
                    <h4>📝 Transcription</h4>
                    <div class="transcription-box">
                        {selectedEvent.transcription}
                    </div>
                </div>

                <div class="section analysis-section">
                    <h4>🧠 Extracted Meaning</h4>
                    {#if loadingExtraction}
                        <div class="loading-state">Analyzing...</div>
                    {:else if extractionData}
                        <div class="analysis-grid">
                            <div class="analysis-item full-width">
                                <label>Summary</label>
                                <p>{extractionData.summary || "N/A"}</p>
                            </div>
                            <div class="analysis-item">
                                <label>Category</label>
                                <span class="badge"
                                    >{extractionData.category || "Other"}</span
                                >
                            </div>
                            <div class="analysis-item">
                                <label>Importance</label>
                                <span
                                    class="badge {extractionData.importance?.toLowerCase()}"
                                    >{extractionData.importance || "Low"}</span
                                >
                            </div>

                            {#if extractionData.entities}
                                <div class="analysis-item full-width">
                                    <label>Entities</label>
                                    <div class="entities-list">
                                        {#each Object.entries(extractionData.entities) as [key, val]}
                                            {#if Array.isArray(val) && val.length > 0}
                                                <div class="entity-row">
                                                    <strong>{key}:</strong>
                                                    {val.join(", ")}
                                                </div>
                                            {/if}
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <p class="placeholder">
                            AI Analysis pending or not available.
                        </p>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .events-container {
        max-width: 900px;
        margin: 0 auto;
        color: #333;
        padding-top: 20px;
    }
    h2 {
        font-size: 1.5rem;
        margin-bottom: 20px;
        color: #111;
    }

    .event-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .event-row {
        background: white;
        border: 1px solid #eee;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 16px;
        transition: all 0.2s;
    }
    .event-row:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border-color: #ddd;
    }

    .col-date {
        display: flex;
        flex-direction: column;
        font-size: 0.85rem;
        color: #666;
        width: 100px;
        flex-shrink: 0;
    }
    .col-date .day {
        font-weight: 600;
        color: #333;
    }

    .col-preview {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #555;
    }
    .col-status {
        font-size: 0.9rem;
    }

    /* Modal */
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
        max-width: 600px;
        max-height: 90vh;
        border-radius: 12px;
        overflow-y: auto;
        padding: 24px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #eee;
        padding-bottom: 12px;
    }
    .modal-header h3 {
        margin: 0;
    }
    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
    }
    .close-btn:hover {
        color: #000;
    }

    .section {
        margin-bottom: 24px;
    }
    h4 {
        margin: 0 0 10px 0;
        color: #555;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
    }

    .audio-player {
        width: 100%;
        margin-top: 4px;
    }
    .transcription-box {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
        line-height: 1.6;
        white-space: pre-wrap;
        font-size: 0.95rem;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #eee;
        color: #333;
    }
    .placeholder {
        font-style: italic;
        color: #999;
        margin: 0;
    }

    .empty-state {
        text-align: center;
        color: #999;
        margin-top: 40px;
    }

    /* Analysis Styles */
    .analysis-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        background: #f1f5f9;
        padding: 16px;
        border-radius: 8px;
    }
    .analysis-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .analysis-item.full-width {
        grid-column: span 2;
    }

    .analysis-item label {
        font-size: 0.75rem;
        text-transform: uppercase;
        color: #64748b;
        font-weight: bold;
    }
    .analysis-item p {
        margin: 0;
        font-size: 0.95rem;
        color: #334155;
    }

    .badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        background: #e2e8f0;
        color: #475569;
        font-size: 0.85rem;
        font-weight: 500;
        align-self: start;
    }
    .badge.high {
        background: #fecaca;
        color: #b91c1c;
    }
    .badge.medium {
        background: #fed7aa;
        color: #c2410c;
    }
    .badge.low {
        background: #dcfce7;
        color: #166534;
    }

    .entity-row {
        font-size: 0.9rem;
        margin-bottom: 4px;
    }
    .entity-row strong {
        text-transform: capitalize;
        color: #475569;
    }
</style>
