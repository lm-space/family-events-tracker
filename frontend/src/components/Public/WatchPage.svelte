<script lang="ts">
    import { onMount } from "svelte";
    import { API_BASE } from "../../lib/stores";

    let videoId: string | null = null;
    let isIdle = false;
    let nextVideoId: string | null = null;
    let activeCat: string | null = null;
    // svelte-ignore non_reactive_update
    let idleTimer: any;

    onMount(async () => {
        const url = new URL(window.location.href);
        const v = url.searchParams.get("v");
        const idParam = url.searchParams.get("id");
        const cat = url.searchParams.get("cat");
        const s = url.searchParams.get("s");

        if (cat) activeCat = cat;

        if (idParam) {
            try {
                const res = await fetch(`${API_BASE}/videos/${idParam}`);
                if (res.ok) {
                    const data = await res.json();
                    videoId = data.youtube_id;
                    sourceType =
                        data.source_type ||
                        (data.thumbnail_url &&
                        !data.thumbnail_url.startsWith("http")
                            ? data.thumbnail_url
                            : "youtube");
                }
            } catch (e) {
                console.error("Failed to fetch video details", e);
            }
        } else if (v) {
            videoId = v;
            sourceType = s || "youtube";
            // Auto-detect for full URLs
            if (
                videoId &&
                (videoId.startsWith("http://") ||
                    videoId.startsWith("https://"))
            ) {
                sourceType = "html";
                if (videoId.includes("instagram.com")) sourceType = "instagram";
                else if (
                    videoId.includes("twitter.com") ||
                    videoId.includes("x.com")
                )
                    sourceType = "twitter";
                else if (videoId.includes("tiktok.com")) sourceType = "tiktok";
                else if (videoId.includes("facebook.com"))
                    sourceType = "facebook";
            }
        }

        // Fetch category videos to determine NEXT video
        if (videoId && cat) {
            try {
                const res = await fetch(
                    `${API_BASE}/videos?category_id=${cat}`,
                );
                if (res.ok) {
                    const videos = await res.json();
                    const idx = videos.findIndex(
                        (vid: any) => vid.youtube_id === videoId,
                    );
                    if (idx !== -1) {
                        // Loop to start if at end
                        const nextIdx = (idx + 1) % videos.length;
                        nextVideoId = videos[nextIdx].youtube_id;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch videos for autoplay", e);
            }
        }

        // Start idle timer logic
        resetTimer();
        window.addEventListener("mousemove", resetTimer);
        window.addEventListener("keydown", resetTimer);
        window.addEventListener("touchstart", resetTimer);
        window.addEventListener("message", handleYtMessage);

        return () => {
            clearTimeout(idleTimer);
            window.removeEventListener("mousemove", resetTimer);
            window.removeEventListener("keydown", resetTimer);
            window.removeEventListener("touchstart", resetTimer);
            window.removeEventListener("message", handleYtMessage);
        };
    });

    function handleYtMessage(e: MessageEvent) {
        try {
            const data = JSON.parse(e.data);
            // YouTube iframe API messages
            if (
                data.event === "infoDelivery" &&
                data.info &&
                data.info.playerState === 0
            ) {
                // Video ENDED (0)
                if (nextVideoId) {
                    playNext();
                }
            }
        } catch (err) {
            // Ignore non-JSON messages
        }
    }

    function playNext() {
        if (!nextVideoId) return;
        const url = new URL(window.location.href);
        url.searchParams.set("v", nextVideoId);
        window.location.href = url.toString();
    }

    function resetTimer() {
        isIdle = false;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            isIdle = true;
        }, 10000); // Hide after 10 seconds
    }

    function goBack() {
        if (activeCat) {
            window.location.href = `/?cat=${activeCat}`;
        } else {
            window.location.href = "/";
        }
    }

    // Configurable state
    let sourceType = "youtube";

    function loadExternalScript(
        id: string,
        src: string,
        reloadCheck?: () => void,
    ) {
        if (document.getElementById(id)) {
            if (reloadCheck) reloadCheck();
            return;
        }
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.async = true;
        script.onload = () => {
            if (reloadCheck) reloadCheck();
        };
        document.body.appendChild(script);
    }

    $: if (sourceType === "instagram") {
        setTimeout(
            () =>
                loadExternalScript(
                    "insta-wjs",
                    "//www.instagram.com/embed.js",
                    () => (window as any).instgrm?.Embeds.process(),
                ),
            100,
        );
    }
    $: if (sourceType === "twitter") {
        setTimeout(
            () =>
                loadExternalScript(
                    "twitter-wjs",
                    "https://platform.twitter.com/widgets.js",
                    () => (window as any).twttr?.widgets?.load(),
                ),
            100,
        );
    }
    $: if (sourceType === "tiktok") {
        setTimeout(
            () =>
                loadExternalScript(
                    "tiktok-wjs",
                    "https://www.tiktok.com/embed.js",
                ),
            100,
        );
    }
</script>

<svelte:head>
    <title>Tube App</title>
</svelte:head>

<div class="watch-container" class:idle={isIdle}>
    {#if videoId}
        <div class="iframe-wrapper">
            <!-- Sensor Zone: Captures mouse movement at the top to reveal controls -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
                class="sensor-zone"
                on:mousemove={resetTimer}
                on:click={resetTimer}
            ></div>

            {#if sourceType === "youtube"}
                <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0&iv_load_policy=3&disablekb=0&enablejsapi=1&origin=${window.location.origin}`}
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    title="Video Player"
                >
                </iframe>
            {:else if sourceType === "vimeo"}
                <iframe
                    src={`https://player.vimeo.com/video/${videoId}?autoplay=1`}
                    frameborder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowfullscreen
                    title="Vimeo"
                ></iframe>
            {:else if sourceType === "instagram"}
                {@const instaId = videoId.includes("instagram.com")
                    ? videoId.match(/\/(p|reel)\/([a-zA-Z0-9_-]+)/)?.[2] ||
                      videoId
                    : videoId}
                <div
                    class="instagram-wrapper"
                    style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;"
                >
                    <iframe
                        src={`https://www.instagram.com/p/${instaId}/embed/captioned/`}
                        width="400"
                        height="100%"
                        frameborder="0"
                        scrolling="no"
                        allowtransparency={true}
                        allowfullscreen={true}
                        style="background: white; max-width: 540px; border-radius: 3px;"
                        title="Instagram"
                    >
                    </iframe>
                </div>
            {:else if sourceType === "twitter"}
                <div
                    class="embed-wrapper twitter"
                    style="width:100%;display:flex;justify-content:center;align-items:center;height:100%;"
                >
                    <blockquote class="twitter-tweet" data-theme="dark">
                        <a href={videoId}></a>
                    </blockquote>
                </div>
            {:else if sourceType === "tiktok"}
                <div
                    class="embed-wrapper tiktok"
                    style="width:100%;display:flex;justify-content:center;align-items:center;height:100%;"
                >
                    <blockquote
                        class="tiktok-embed"
                        cite={videoId}
                        data-video-id={videoId}
                        style="max-width: 605px;min-width: 325px;"
                    >
                        <section>
                            <a target="_blank" href={videoId}></a>
                        </section>
                    </blockquote>
                </div>
            {:else if sourceType === "facebook"}
                <div
                    class="embed-wrapper facebook"
                    style="width:100%;display:flex;justify-content:center;align-items:center;height:100%;"
                >
                    <iframe
                        src={`https://www.facebook.com/plugins/video.php?height=314&href=${encodeURIComponent(videoId)}&show_text=false&width=560&t=0`}
                        width="560"
                        height="314"
                        style="border:none;overflow:hidden"
                        scrolling="no"
                        frameborder="0"
                        allowfullscreen={true}
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        title="Facebook"
                    ></iframe>
                </div>
            {:else if sourceType === "html"}
                <iframe
                    src={videoId}
                    class="web-frame"
                    frameborder="0"
                    allowfullscreen
                    title="Web Content"
                ></iframe>
            {:else}
                <!-- Fallback for social embeds that might need special widgets or just open -->
                <div class="external-embed">
                    <h2>Content from {sourceType}</h2>
                    <p>This content requires an external player or script.</p>
                    <a
                        href={sourceType === "html" ? videoId : "#"}
                        target="_blank"
                        class="open-btn">Open Original Link</a
                    >
                </div>
            {/if}

            <div class="controls-overlay" on:mousemove={resetTimer}>
                <button class="back-btn" on:click={goBack}> ← Back </button>
            </div>
        </div>
    {:else}
        <div class="error">Loading...</div>
    {/if}
</div>

<style>
    .watch-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: black;
        z-index: 1000;
        display: flex;
        flex-direction: column;
    }
    .iframe-wrapper {
        flex: 1;
        position: relative;
    }
    iframe {
        width: 100%;
        height: 100%;
        border: none;
    }

    /* Sensor Zone: Invisible top area to catch mouse events */
    .sensor-zone {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 15%; /* Top 15% of screen */
        z-index: 1001; /* Above iframe */
        cursor: default;
    }

    .controls-overlay {
        position: absolute;
        top: 20px;
        left: 20px;
        transition: opacity 0.3s ease;
        opacity: 1;
        pointer-events: auto;
        z-index: 1002; /* Above sensor */
    }

    /* Hide overlay when idle */
    .watch-container.idle .controls-overlay {
        opacity: 0;
        pointer-events: none;
    }

    .back-btn {
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 10px 20px;
        font-size: 1.2rem;
        cursor: pointer;
        border-radius: 8px;
        backdrop-filter: blur(4px);
    }
    .back-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    .error {
        color: white;
        font-size: 1.5rem;
        text-align: center;
        margin-top: 50px;
    }
    .web-frame {
        width: 100%;
        height: 100%;
        background: white;
    }
    .external-embed {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
    }
    .open-btn {
        margin-top: 20px;
        background: #2563eb;
        color: white;
        padding: 10px 20px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
    }
</style>
