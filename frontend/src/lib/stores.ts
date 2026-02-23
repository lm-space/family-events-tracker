import { writable } from 'svelte/store';

export const token = writable(localStorage.getItem('token') || '');
export const videos = writable<any[]>([]);
export const categories = writable<any[]>([]);
export const playlists = writable<any[]>([]);
export const events = writable([]);
export const eventData = writable([]); // For extracted data

// Diary feature stores
export const notes = writable<any[]>([]);
export const people = writable<any[]>([]);
export const tags = writable<any[]>([]);
export const diaryCategories = writable<any[]>([]);

token.subscribe((val) => {
    if (val) localStorage.setItem('token', val);
    else localStorage.removeItem('token');
});

export const API_BASE = import.meta.env.DEV ? '/api' : 'https://events-api.twozao.com/api';

export async function refreshData() {
    const t = localStorage.getItem('token');

    try {
        const res = await fetch(`${API_BASE}/events`);
        if (res.ok) {
            events.set(await res.json());
        }
    } catch (e) {
        console.error("Failed to fetch data", e);
    }
}

// Diary data fetchers
export async function fetchNotes(filters?: Record<string, string>) {
    try {
        let url = `${API_BASE}/notes`;
        if (filters) {
            const params = new URLSearchParams(filters);
            url += `?${params.toString()}`;
        }
        const res = await fetch(url);
        if (res.ok) {
            notes.set(await res.json());
        }
    } catch (e) {
        console.error("Failed to fetch notes", e);
    }
}

export async function fetchPeople() {
    try {
        const res = await fetch(`${API_BASE}/people`);
        if (res.ok) {
            people.set(await res.json());
        }
    } catch (e) {
        console.error("Failed to fetch people", e);
    }
}

export async function fetchTags() {
    try {
        const res = await fetch(`${API_BASE}/tags`);
        if (res.ok) {
            tags.set(await res.json());
        }
    } catch (e) {
        console.error("Failed to fetch tags", e);
    }
}

export async function fetchDiaryCategories() {
    try {
        const res = await fetch(`${API_BASE}/categories`);
        if (res.ok) {
            diaryCategories.set(await res.json());
        }
    } catch (e) {
        console.error("Failed to fetch categories", e);
    }
}

export async function searchDiary(query: string) {
    try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Search failed", e);
    }
    return { notes: [], people: [] };
}

// Habit tracker stores
export const familyHabitsSummary = writable<any[]>([]);
export const selectedPersonHabits = writable<any[]>([]);
export const habitStats = writable<any[]>([]);

// Habit tracker functions
export async function fetchFamilyHabitsSummary() {
    try {
        const res = await fetch(`${API_BASE}/family-habits-summary`);
        if (res.ok) {
            familyHabitsSummary.set(await res.json());
        }
    } catch (e) {
        console.error("Failed to fetch family habits summary", e);
    }
}

export async function fetchPersonHabitsToday(personId: number) {
    try {
        const res = await fetch(`${API_BASE}/people/${personId}/habits/today`);
        if (res.ok) {
            selectedPersonHabits.set(await res.json());
            return await res.json();
        }
    } catch (e) {
        console.error("Failed to fetch person habits", e);
    }
    return [];
}

export async function fetchHabitStats(personId: number, days = 30) {
    try {
        const res = await fetch(`${API_BASE}/people/${personId}/habit-stats?days=${days}`);
        if (res.ok) {
            const stats = await res.json();
            habitStats.set(stats);
            return stats;
        }
    } catch (e) {
        console.error("Failed to fetch habit stats", e);
    }
    return [];
}

export async function toggleHabit(habitId: number, date?: string) {
    try {
        const res = await fetch(`${API_BASE}/habits/${habitId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date })
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Failed to toggle habit", e);
    }
    return null;
}

export async function initDefaultHabits(personId: number) {
    try {
        const res = await fetch(`${API_BASE}/people/${personId}/habits/init-defaults`, {
            method: 'POST'
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Failed to init default habits", e);
    }
    return null;
}

export async function addHabitNote(habitId: number, note: string, date?: string) {
    try {
        const res = await fetch(`${API_BASE}/habits/${habitId}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note, date })
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Failed to add habit note", e);
    }
    return null;
}
