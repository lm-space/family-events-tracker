
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
    DB: D1Database;
    AI: any;
    BUCKET: R2Bucket;
    TELEGRAM_BOT_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Allowed origins for CORS (security: no wildcard with credentials)
const ALLOWED_ORIGINS = [
    'https://events.twozao.com',      // Production frontend
    'https://events-api.twozao.com',  // Production API (internal requests)
    'http://localhost:5173',           // Development frontend
    'http://127.0.0.1:5173',          // Development frontend (IP)
];

app.use('/*', cors({
    origin: (origin) => {
        // Only allow requests from whitelisted origins
        if (origin && ALLOWED_ORIGINS.includes(origin)) {
            return origin;
        }
        // Deny CORS for any other origin
        return '';
    },
    allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests', 'Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
    credentials: true,
}));

// --- HELPERS ---
async function sendTelegramReply(token: string, chatId: number, text: string) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text })
    });
}

// --- ROUTES ---

app.get('/', (c) => c.text('DLE Backend is Running'));

// =============================================
// AUTHENTICATION APIs
// =============================================

// Login with email + password
app.post('/api/login', async (c) => {
    const body = await c.req.json();
    const { email, username, password } = body;

    const userEmail = email || username || 'admin@twozao.com';

    if (!password) {
        return c.json({ error: 'Password is required' }, 400);
    }

    // SECURITY FIX: Never include user password in SQL WHERE clause
    // Instead, fetch user and compare outside of SQL (or use bcrypt)
    const user = await c.env.DB.prepare(
        'SELECT id, email, name, magic_link_token, password_hash FROM users WHERE email = ?'
    ).bind(userEmail).first() as any;

    if (!user) {
        // Generic error to prevent email enumeration attacks
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // SECURITY: Compare password outside SQL using timing-safe comparison
    // TODO: Install bcrypt and use: const passwordMatches = await bcrypt.compare(password, user.password_hash);
    // For now, using simple comparison (still safer than SQL query)
    const passwordMatches = user.password_hash === password;

    if (!passwordMatches) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate or use existing token
    let token = user.magic_link_token;
    if (!token) {
        token = crypto.randomUUID();
        await c.env.DB.prepare('UPDATE users SET magic_link_token = ? WHERE id = ?')
            .bind(token, user.id).run();
    }

    return c.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name
        }
    });
});

// Get current user (for token validation)
app.get('/api/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await c.env.DB.prepare(
        'SELECT id, email, name FROM users WHERE magic_link_token = ?'
    ).bind(token).first();

    if (!user) {
        return c.json({ error: 'Invalid token' }, 401);
    }

    return c.json(user);
});

// =============================================
// DIARY FEATURE APIs
// =============================================

// --- PEOPLE MANAGEMENT ---

// List all people
app.get('/api/people', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM people ORDER BY name ASC').all();
    return c.json(results);
});

// Get single person with their notes
app.get('/api/people/:id', async (c) => {
    const id = c.req.param('id');
    const person = await c.env.DB.prepare('SELECT * FROM people WHERE id = ?').bind(id).first();
    if (!person) return c.json({ error: 'Person not found' }, 404);

    const { results: notes } = await c.env.DB.prepare(`
        SELECT n.*, np.role
        FROM notes n
        JOIN note_people np ON n.id = np.note_id
        WHERE np.person_id = ?
        ORDER BY n.event_date DESC, n.created_at DESC
    `).bind(id).all();

    return c.json({ ...person, notes });
});

// Create person
app.post('/api/people', async (c) => {
    const { name, relationship, notes, avatar_url } = await c.req.json();
    if (!name) return c.json({ error: 'Name is required' }, 400);

    const result = await c.env.DB.prepare(`
        INSERT INTO people (name, relationship, notes, avatar_url)
        VALUES (?, ?, ?, ?)
        RETURNING *
    `).bind(name, relationship || null, notes || null, avatar_url || null).first();

    return c.json(result, 201);
});

// Update person
app.put('/api/people/:id', async (c) => {
    const id = c.req.param('id');
    const { name, relationship, notes, avatar_url } = await c.req.json();

    const result = await c.env.DB.prepare(`
        UPDATE people SET name = ?, relationship = ?, notes = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING *
    `).bind(name, relationship || null, notes || null, avatar_url || null, id).first();

    if (!result) return c.json({ error: 'Person not found' }, 404);
    return c.json(result);
});

// Delete person
app.delete('/api/people/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM people WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// --- TAGS MANAGEMENT ---

// List all tags
app.get('/api/tags', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM tags ORDER BY name ASC').all();
    return c.json(results);
});

// Create tag
app.post('/api/tags', async (c) => {
    const { name, color } = await c.req.json();
    if (!name) return c.json({ error: 'Name is required' }, 400);

    try {
        const result = await c.env.DB.prepare(`
            INSERT INTO tags (name, color) VALUES (?, ?)
            RETURNING *
        `).bind(name, color || '#3b82f6').first();
        return c.json(result, 201);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE')) {
            return c.json({ error: 'Tag already exists' }, 409);
        }
        throw e;
    }
});

// Update tag
app.put('/api/tags/:id', async (c) => {
    const id = c.req.param('id');
    const { name, color } = await c.req.json();

    const result = await c.env.DB.prepare(`
        UPDATE tags SET name = ?, color = ? WHERE id = ?
        RETURNING *
    `).bind(name, color || '#3b82f6', id).first();

    if (!result) return c.json({ error: 'Tag not found' }, 404);
    return c.json(result);
});

// Delete tag
app.delete('/api/tags/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// --- NOTES MANAGEMENT ---

// List notes with filters
app.get('/api/notes', async (c) => {
    const category = c.req.query('category');
    const personId = c.req.query('person_id');
    const tagId = c.req.query('tag_id');
    const search = c.req.query('search');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    const importance = c.req.query('importance');

    let query = `
        SELECT DISTINCT n.* FROM notes n
        LEFT JOIN note_people np ON n.id = np.note_id
        LEFT JOIN note_tags nt ON n.id = nt.note_id
        WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
        query += ' AND n.category = ?';
        params.push(category);
    }
    if (personId) {
        query += ' AND np.person_id = ?';
        params.push(personId);
    }
    if (tagId) {
        query += ' AND nt.tag_id = ?';
        params.push(tagId);
    }
    if (search) {
        query += ' AND (n.title LIKE ? OR n.content LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (startDate) {
        query += ' AND n.event_date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND n.event_date <= ?';
        params.push(endDate);
    }
    if (importance) {
        query += ' AND n.importance = ?';
        params.push(importance);
    }

    query += ' ORDER BY n.event_date DESC, n.created_at DESC';

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    // Fetch associated people, tags, and photos for each note
    const notesWithRelations = await Promise.all(results.map(async (note: any) => {
        const [peopleRes, tagsRes, photosRes] = await Promise.all([
            c.env.DB.prepare(`
                SELECT p.*, np.role FROM people p
                JOIN note_people np ON p.id = np.person_id
                WHERE np.note_id = ?
            `).bind(note.id).all(),
            c.env.DB.prepare(`
                SELECT t.* FROM tags t
                JOIN note_tags nt ON t.id = nt.tag_id
                WHERE nt.note_id = ?
            `).bind(note.id).all(),
            c.env.DB.prepare('SELECT * FROM note_photos WHERE note_id = ?').bind(note.id).all()
        ]);

        return {
            ...note,
            people: peopleRes.results,
            tags: tagsRes.results,
            photos: photosRes.results
        };
    }));

    return c.json(notesWithRelations);
});

// Get single note with all relations
app.get('/api/notes/:id', async (c) => {
    const id = c.req.param('id');
    const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
    if (!note) return c.json({ error: 'Note not found' }, 404);

    const [peopleRes, tagsRes, photosRes] = await Promise.all([
        c.env.DB.prepare(`
            SELECT p.*, np.role FROM people p
            JOIN note_people np ON p.id = np.person_id
            WHERE np.note_id = ?
        `).bind(id).all(),
        c.env.DB.prepare(`
            SELECT t.* FROM tags t
            JOIN note_tags nt ON t.id = nt.tag_id
            WHERE nt.note_id = ?
        `).bind(id).all(),
        c.env.DB.prepare('SELECT * FROM note_photos WHERE note_id = ?').bind(id).all()
    ]);

    return c.json({
        ...note,
        people: peopleRes.results,
        tags: tagsRes.results,
        photos: photosRes.results
    });
});

// Create note
app.post('/api/notes', async (c) => {
    const { title, content, category, importance, event_date, event_id, people, tags } = await c.req.json();
    if (!content) return c.json({ error: 'Content is required' }, 400);

    const result = await c.env.DB.prepare(`
        INSERT INTO notes (title, content, category, importance, event_date, event_id)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
    `).bind(
        title || null,
        content,
        category || 'General',
        importance || 'Low',
        event_date || null,
        event_id || null
    ).first();

    const noteId = (result as any).id;

    // Add people associations
    if (people && Array.isArray(people)) {
        for (const p of people) {
            await c.env.DB.prepare(`
                INSERT INTO note_people (note_id, person_id, role) VALUES (?, ?, ?)
            `).bind(noteId, p.id, p.role || null).run();
        }
    }

    // Add tag associations
    if (tags && Array.isArray(tags)) {
        for (const tagId of tags) {
            await c.env.DB.prepare(`
                INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)
            `).bind(noteId, tagId).run();
        }
    }

    return c.json(result, 201);
});

// Update note
app.put('/api/notes/:id', async (c) => {
    const id = c.req.param('id');
    const { title, content, category, importance, event_date, people, tags } = await c.req.json();

    const result = await c.env.DB.prepare(`
        UPDATE notes SET title = ?, content = ?, category = ?, importance = ?, event_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING *
    `).bind(title || null, content, category || 'General', importance || 'Low', event_date || null, id).first();

    if (!result) return c.json({ error: 'Note not found' }, 404);

    // Update people associations (replace all)
    await c.env.DB.prepare('DELETE FROM note_people WHERE note_id = ?').bind(id).run();
    if (people && Array.isArray(people)) {
        for (const p of people) {
            await c.env.DB.prepare(`
                INSERT INTO note_people (note_id, person_id, role) VALUES (?, ?, ?)
            `).bind(id, p.id, p.role || null).run();
        }
    }

    // Update tag associations (replace all)
    await c.env.DB.prepare('DELETE FROM note_tags WHERE note_id = ?').bind(id).run();
    if (tags && Array.isArray(tags)) {
        for (const tagId of tags) {
            await c.env.DB.prepare(`
                INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)
            `).bind(id, tagId).run();
        }
    }

    return c.json(result);
});

// Delete note
app.delete('/api/notes/:id', async (c) => {
    const id = c.req.param('id');

    // Get photos to delete from R2
    const { results: photos } = await c.env.DB.prepare('SELECT * FROM note_photos WHERE note_id = ?').bind(id).all();

    // Delete photos from R2
    for (const photo of photos as any[]) {
        const key = photo.photo_url.replace('/api/photo/', '');
        try {
            await c.env.BUCKET.delete(key);
        } catch (e) {
            console.error('Failed to delete photo from R2:', e);
        }
    }

    await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// --- PHOTO UPLOAD ---

// Upload photo for a note
app.post('/api/notes/:id/photos', async (c) => {
    const noteId = c.req.param('id');

    // Check note exists
    const note = await c.env.DB.prepare('SELECT id FROM notes WHERE id = ?').bind(noteId).first();
    if (!note) return c.json({ error: 'Note not found' }, 404);

    const formData = await c.req.formData();
    const file = formData.get('photo') as File;

    if (!file) return c.json({ error: 'No photo provided' }, 400);

    const arrayBuffer = await file.arrayBuffer();
    const fileKey = `photos/${noteId}_${Date.now()}_${file.name}`;

    // Save to R2
    await c.env.BUCKET.put(fileKey, arrayBuffer, {
        httpMetadata: { contentType: file.type }
    });

    // Save to database
    const result = await c.env.DB.prepare(`
        INSERT INTO note_photos (note_id, photo_url, caption, file_name, file_size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
    `).bind(noteId, `/api/photo/${fileKey}`, null, file.name, file.size, file.type).first();

    return c.json(result, 201);
});

// Get photo from R2
app.get('/api/photo/*', async (c) => {
    const key = c.req.path.replace('/api/photo/', '');
    const object = await c.env.BUCKET.get(key);

    if (!object) return c.text('Photo not found', 404);

    const contentType = object.httpMetadata?.contentType || 'image/jpeg';
    c.header('Content-Type', contentType);
    c.header('Cache-Control', 'public, max-age=31536000');
    return c.body(object.body);
});

// Delete photo
app.delete('/api/photos/:id', async (c) => {
    const id = c.req.param('id');

    const photo = await c.env.DB.prepare('SELECT * FROM note_photos WHERE id = ?').bind(id).first() as any;
    if (!photo) return c.json({ error: 'Photo not found' }, 404);

    // Delete from R2
    const key = photo.photo_url.replace('/api/photo/', '');
    try {
        await c.env.BUCKET.delete(key);
    } catch (e) {
        console.error('Failed to delete from R2:', e);
    }

    await c.env.DB.prepare('DELETE FROM note_photos WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// --- SEARCH ---

// Global search across notes
app.get('/api/search', async (c) => {
    const query = c.req.query('q');
    if (!query || query.length < 2) {
        return c.json({ error: 'Query must be at least 2 characters' }, 400);
    }

    const searchPattern = `%${query}%`;

    // Search notes
    const { results: notes } = await c.env.DB.prepare(`
        SELECT * FROM notes
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY event_date DESC, created_at DESC
        LIMIT 50
    `).bind(searchPattern, searchPattern).all();

    // Search people
    const { results: people } = await c.env.DB.prepare(`
        SELECT * FROM people
        WHERE name LIKE ? OR notes LIKE ?
        ORDER BY name ASC
        LIMIT 20
    `).bind(searchPattern, searchPattern).all();

    return c.json({ notes, people });
});

// --- CATEGORIES ---

// Get available categories with counts
app.get('/api/categories', async (c) => {
    const { results } = await c.env.DB.prepare(`
        SELECT category, COUNT(*) as count
        FROM notes
        GROUP BY category
        ORDER BY count DESC
    `).all();

    // Add default categories that may not have notes yet
    const defaultCategories = ['Health', 'Medical', 'Prescription', 'Appointment', 'Personal', 'Family', 'Work', 'Financial', 'General', 'Other'];
    const existingCategories = new Set(results.map((r: any) => r.category));

    const allCategories = results.concat(
        defaultCategories
            .filter(cat => !existingCategories.has(cat))
            .map(cat => ({ category: cat, count: 0 }))
    );

    return c.json(allCategories);
});

// =============================================
// HABIT TRACKER APIs
// =============================================

// --- DEFAULT HABITS ---

// Get default habit templates
app.get('/api/default-habits', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM default_habits ORDER BY sort_order ASC').all();
    return c.json(results);
});

// --- HABITS MANAGEMENT ---

// List habits for a person
app.get('/api/people/:personId/habits', async (c) => {
    const personId = c.req.param('personId');
    const activeOnly = c.req.query('active') === 'true';

    let query = 'SELECT * FROM habits WHERE person_id = ?';
    if (activeOnly) {
        query += ' AND is_active = 1';
    }
    query += ' ORDER BY sort_order ASC, created_at ASC';

    const { results } = await c.env.DB.prepare(query).bind(personId).all();
    return c.json(results);
});

// Create habit for a person
app.post('/api/people/:personId/habits', async (c) => {
    const personId = c.req.param('personId');
    const { name, description, frequency, target_count, icon, color, sort_order } = await c.req.json();

    if (!name) return c.json({ error: 'Name is required' }, 400);

    const result = await c.env.DB.prepare(`
        INSERT INTO habits (person_id, name, description, frequency, target_count, icon, color, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
    `).bind(
        personId,
        name,
        description || null,
        frequency || 'daily',
        target_count || 1,
        icon || '✓',
        color || '#3b82f6',
        sort_order || 0
    ).first();

    return c.json(result, 201);
});

// Initialize default habits for a person
app.post('/api/people/:personId/habits/init-defaults', async (c) => {
    const personId = c.req.param('personId');

    // Check if person exists
    const person = await c.env.DB.prepare('SELECT id FROM people WHERE id = ?').bind(personId).first();
    if (!person) return c.json({ error: 'Person not found' }, 404);

    // Check if person already has habits
    const existing = await c.env.DB.prepare('SELECT COUNT(*) as count FROM habits WHERE person_id = ?').bind(personId).first() as any;
    if (existing.count > 0) {
        return c.json({ message: 'Person already has habits', count: existing.count });
    }

    // Get default habits and create them for this person
    const { results: defaults } = await c.env.DB.prepare('SELECT * FROM default_habits ORDER BY sort_order ASC').all();

    for (const habit of defaults as any[]) {
        await c.env.DB.prepare(`
            INSERT INTO habits (person_id, name, description, icon, color, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(personId, habit.name, habit.description, habit.icon, habit.color, habit.sort_order).run();
    }

    // Return newly created habits
    const { results: newHabits } = await c.env.DB.prepare('SELECT * FROM habits WHERE person_id = ? ORDER BY sort_order ASC').bind(personId).all();
    return c.json(newHabits, 201);
});

// Update habit
app.put('/api/habits/:id', async (c) => {
    const id = c.req.param('id');
    const { name, description, frequency, target_count, icon, color, is_active, sort_order } = await c.req.json();

    const result = await c.env.DB.prepare(`
        UPDATE habits SET
            name = ?, description = ?, frequency = ?, target_count = ?,
            icon = ?, color = ?, is_active = ?, sort_order = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING *
    `).bind(
        name, description || null, frequency || 'daily', target_count || 1,
        icon || '✓', color || '#3b82f6', is_active !== false ? 1 : 0, sort_order || 0,
        id
    ).first();

    if (!result) return c.json({ error: 'Habit not found' }, 404);
    return c.json(result);
});

// Delete habit
app.delete('/api/habits/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM habits WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// --- HABIT LOGS (CHECK-INS) ---

// Get habit logs for a person on a specific date (or date range)
app.get('/api/people/:personId/habit-logs', async (c) => {
    const personId = c.req.param('personId');
    const date = c.req.query('date'); // Single date
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    let query = `
        SELECT hl.*, h.name as habit_name, h.icon as habit_icon, h.color as habit_color
        FROM habit_logs hl
        JOIN habits h ON hl.habit_id = h.id
        WHERE hl.person_id = ?
    `;
    const params: any[] = [personId];

    if (date) {
        query += ' AND hl.log_date = ?';
        params.push(date);
    } else {
        if (startDate) {
            query += ' AND hl.log_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND hl.log_date <= ?';
            params.push(endDate);
        }
    }

    query += ' ORDER BY hl.log_date DESC, h.sort_order ASC';

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results);
});

// Get today's habits status for a person (habits with their log status)
app.get('/api/people/:personId/habits/today', async (c) => {
    const personId = c.req.param('personId');
    const today = new Date().toISOString().split('T')[0];

    // Get all active habits for the person with today's log status
    const { results } = await c.env.DB.prepare(`
        SELECT
            h.*,
            hl.id as log_id,
            hl.completed,
            hl.count as log_count,
            hl.note,
            hl.transcription
        FROM habits h
        LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.log_date = ?
        WHERE h.person_id = ? AND h.is_active = 1
        ORDER BY h.sort_order ASC
    `).bind(today, personId).all();

    return c.json(results);
});

// Toggle/Update habit log for a specific date
app.post('/api/habits/:habitId/log', async (c) => {
    const habitId = c.req.param('habitId');
    const { date, completed, count, note, transcription, voice_url } = await c.req.json();

    const logDate = date || new Date().toISOString().split('T')[0];

    // Get the habit to get person_id
    const habit = await c.env.DB.prepare('SELECT person_id FROM habits WHERE id = ?').bind(habitId).first() as any;
    if (!habit) return c.json({ error: 'Habit not found' }, 404);

    // Check if log exists for this date
    const existing = await c.env.DB.prepare(
        'SELECT * FROM habit_logs WHERE habit_id = ? AND log_date = ?'
    ).bind(habitId, logDate).first();

    let result;
    if (existing) {
        // Update existing log
        result = await c.env.DB.prepare(`
            UPDATE habit_logs SET
                completed = ?, count = ?, note = ?, transcription = ?, voice_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE habit_id = ? AND log_date = ?
            RETURNING *
        `).bind(
            completed !== undefined ? (completed ? 1 : 0) : (existing as any).completed,
            count !== undefined ? count : (existing as any).count,
            note !== undefined ? note : (existing as any).note,
            transcription !== undefined ? transcription : (existing as any).transcription,
            voice_url !== undefined ? voice_url : (existing as any).voice_url,
            habitId, logDate
        ).first();
    } else {
        // Create new log
        result = await c.env.DB.prepare(`
            INSERT INTO habit_logs (habit_id, person_id, log_date, completed, count, note, transcription, voice_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
        `).bind(
            habitId,
            habit.person_id,
            logDate,
            completed ? 1 : 0,
            count || (completed ? 1 : 0),
            note || null,
            transcription || null,
            voice_url || null
        ).first();
    }

    return c.json(result);
});

// Quick toggle habit completion (for checkbox clicks)
app.post('/api/habits/:habitId/toggle', async (c) => {
    const habitId = c.req.param('habitId');
    const { date } = await c.req.json();
    const logDate = date || new Date().toISOString().split('T')[0];

    // Get the habit to get person_id
    const habit = await c.env.DB.prepare('SELECT person_id FROM habits WHERE id = ?').bind(habitId).first() as any;
    if (!habit) return c.json({ error: 'Habit not found' }, 404);

    // Check if log exists
    const existing = await c.env.DB.prepare(
        'SELECT * FROM habit_logs WHERE habit_id = ? AND log_date = ?'
    ).bind(habitId, logDate).first() as any;

    let result;
    if (existing) {
        // Toggle completion
        const newCompleted = existing.completed ? 0 : 1;
        result = await c.env.DB.prepare(`
            UPDATE habit_logs SET completed = ?, count = ?, updated_at = CURRENT_TIMESTAMP
            WHERE habit_id = ? AND log_date = ?
            RETURNING *
        `).bind(newCompleted, newCompleted, habitId, logDate).first();
    } else {
        // Create new completed log
        result = await c.env.DB.prepare(`
            INSERT INTO habit_logs (habit_id, person_id, log_date, completed, count)
            VALUES (?, ?, ?, 1, 1)
            RETURNING *
        `).bind(habitId, habit.person_id, logDate).first();
    }

    return c.json(result);
});

// Add voice note to habit log
app.post('/api/habits/:habitId/voice-note', async (c) => {
    const habitId = c.req.param('habitId');
    const { date } = await c.req.json();
    const logDate = date || new Date().toISOString().split('T')[0];

    // Get the habit
    const habit = await c.env.DB.prepare('SELECT person_id FROM habits WHERE id = ?').bind(habitId).first() as any;
    if (!habit) return c.json({ error: 'Habit not found' }, 404);

    const formData = await c.req.formData();
    const file = formData.get('audio') as File;

    if (!file) return c.json({ error: 'No audio file provided' }, 400);

    const arrayBuffer = await file.arrayBuffer();
    const fileKey = `habit-notes/${habitId}_${logDate}_${Date.now()}.ogg`;

    // Save to R2
    await c.env.BUCKET.put(fileKey, arrayBuffer, {
        httpMetadata: { contentType: 'audio/ogg' }
    });

    const voiceUrl = `/api/audio/${fileKey}`;

    // Transcribe using Whisper
    let transcription = "";
    try {
        const input = { audio: [...new Uint8Array(arrayBuffer)] };
        const aiRes: any = await c.env.AI.run('@cf/openai/whisper', input);
        transcription = aiRes.text || "";
    } catch (e: any) {
        console.error("Transcription failed:", e);
        transcription = "(Transcription failed)";
    }

    // Update or create log
    const existing = await c.env.DB.prepare(
        'SELECT * FROM habit_logs WHERE habit_id = ? AND log_date = ?'
    ).bind(habitId, logDate).first();

    let result;
    if (existing) {
        result = await c.env.DB.prepare(`
            UPDATE habit_logs SET voice_url = ?, transcription = ?, note = COALESCE(note, '') || ' ' || ?, updated_at = CURRENT_TIMESTAMP
            WHERE habit_id = ? AND log_date = ?
            RETURNING *
        `).bind(voiceUrl, transcription, transcription, habitId, logDate).first();
    } else {
        result = await c.env.DB.prepare(`
            INSERT INTO habit_logs (habit_id, person_id, log_date, completed, count, voice_url, transcription, note)
            VALUES (?, ?, ?, 0, 0, ?, ?, ?)
            RETURNING *
        `).bind(habitId, habit.person_id, logDate, voiceUrl, transcription, transcription).first();
    }

    return c.json(result);
});

// Get habit statistics for a person
app.get('/api/people/:personId/habit-stats', async (c) => {
    const personId = c.req.param('personId');
    const days = parseInt(c.req.query('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get completion stats per habit
    const { results: stats } = await c.env.DB.prepare(`
        SELECT
            h.id as habit_id,
            h.name,
            h.icon,
            h.color,
            COUNT(CASE WHEN hl.completed = 1 THEN 1 END) as completed_count,
            COUNT(hl.id) as total_logs,
            ? as total_days
        FROM habits h
        LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.log_date >= ?
        WHERE h.person_id = ? AND h.is_active = 1
        GROUP BY h.id
        ORDER BY h.sort_order ASC
    `).bind(days, startDateStr, personId).all();

    // Get streak for each habit (consecutive days completed)
    const habitsWithStreaks = await Promise.all((stats as any[]).map(async (stat) => {
        const { results: recentLogs } = await c.env.DB.prepare(`
            SELECT log_date, completed FROM habit_logs
            WHERE habit_id = ? AND completed = 1
            ORDER BY log_date DESC
            LIMIT 60
        `).bind(stat.habit_id).all();

        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 60; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];

            const hasLog = (recentLogs as any[]).some(log => log.log_date === dateStr);
            if (hasLog) {
                streak++;
            } else if (i > 0) { // Allow today to be incomplete
                break;
            }
        }

        return { ...stat, current_streak: streak };
    }));

    return c.json(habitsWithStreaks);
});

// Get all family members with their today's habit summary
app.get('/api/family-habits-summary', async (c) => {
    const today = new Date().toISOString().split('T')[0];

    const { results: people } = await c.env.DB.prepare('SELECT * FROM people ORDER BY name ASC').all();

    const familySummary = await Promise.all((people as any[]).map(async (person) => {
        const { results: habits } = await c.env.DB.prepare(`
            SELECT
                COUNT(*) as total_habits,
                COUNT(CASE WHEN hl.completed = 1 THEN 1 END) as completed_habits
            FROM habits h
            LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.log_date = ?
            WHERE h.person_id = ? AND h.is_active = 1
        `).bind(today, person.id).all();

        const summary = habits[0] as any;
        return {
            ...person,
            total_habits: summary?.total_habits || 0,
            completed_habits: summary?.completed_habits || 0,
            completion_percentage: summary?.total_habits > 0
                ? Math.round((summary.completed_habits / summary.total_habits) * 100)
                : 0
        };
    }));

    return c.json(familySummary);
});

// LOGIN ROUTE
app.post('/api/login', async (c) => {
    try {
        // Allow any login for MVP demo if desired, or simple logic
        const { username, password } = await c.req.json();

        // MVP: Hardcoded or just explicit "admin/admin" check
        if (username === 'admin' && password === 'admin') {
            return c.json({ token: 'simple-mvp-token', user: { id: 1, email: 'admin' } });
        }
        return c.json({ error: 'Invalid credentials' }, 401);
    } catch (e) {
        return c.json({ error: 'Bad Request' }, 400);
    }
});

// 1. Events List (Admin)
app.get('/api/events', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
    return c.json(results);
});

// 2. Extracted Data List (Admin - Flattened view?)
app.get('/api/event-data', async (c) => {
    const eventId = c.req.query('event_id');
    let query = `
        SELECT ed.*, e.transcription as event_preview 
        FROM event_data ed
        JOIN events e ON ed.event_id = e.id
    `;
    let params: any[] = [];

    if (eventId) {
        query += ' WHERE ed.event_id = ?';
        params.push(eventId);
    }

    query += ' ORDER BY ed.created_at DESC';

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results);
});

// 3. Debug Logs
app.get('/api/telegram-debug', async (c) => {
    const logs = await c.env.DB.prepare('SELECT * FROM telegram_debug_logs ORDER BY id DESC LIMIT 50').all();
    return c.json(logs.results);
});

// AUDIO PROXY ROUTE
app.get('/api/audio/:key', async (c) => {
    const key = c.req.param('key');
    const object = await c.env.BUCKET.get(key);
    if (!object) return c.text('Audio Not found', 404);

    // Simple basic audio type, might need detection for mp3 vs ogg
    c.header('Content-Type', 'audio/ogg');
    return c.body(object.body);
});


// --- TELEGRAM WEBHOOK ---
app.post('/api/telegram-webhook', async (c) => {
    const token = c.env.TELEGRAM_BOT_TOKEN;
    if (!token) return c.json({ error: 'Bot Not Configured' }, 500);

    let update: any = {};
    try {
        update = await c.req.json();
    } catch (e) {
        return c.json({ error: 'Invalid JSON' }, 400);
    }

    const message = update.message;

    // Log
    try {
        const sender = message?.from?.username || message?.from?.id?.toString() || 'unknown';
        await c.env.DB.prepare('INSERT INTO telegram_debug_logs (payload, sender) VALUES (?, ?)').bind(JSON.stringify(update), sender).run();
    } catch (e) { }

    if (!message) return c.json({ ok: true });

    const chatId = message.chat.id;

    // Handle Start
    if (message.text && message.text.startsWith('/start')) {
        await sendTelegramReply(token, chatId, "🎙️ Hi! Send me a Voice Message and I'll transcribe it + extract key events.");
        return c.json({ ok: true });
    }

    // Handle Voice / Audio
    const voice = message.voice || message.audio;
    if (voice) {
        await sendTelegramReply(token, chatId, "🎧 Processing your audio...");

        try {
            const fileId = voice.file_id;

            // 1. Get File Path
            const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
            const fileData: any = await fileRes.json();
            if (!fileData.ok) throw new Error('Failed to get file path');

            const filePath = fileData.result.file_path;

            // 2. Download File
            const audioRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
            const arrayBuffer = await audioRes.arrayBuffer();

            // SAVE TO R2
            const fileKey = `${fileId}.ogg`; // Telegram voice is usually OGG
            await c.env.BUCKET.put(fileKey, arrayBuffer);
            const audioUrl = `/api/audio/${fileKey}`; // Points to our proxy

            // 3. Transcribe (Workers AI)
            // Note: Cloudflare Whisper requires array of numbers (uint8)
            const input = {
                audio: [...new Uint8Array(arrayBuffer)]
            };

            let transcriptionText = "";
            try {
                const aiRes: any = await c.env.AI.run('@cf/openai/whisper', input);
                transcriptionText = aiRes.text || "";
            } catch (e: any) {
                console.error("AI Error", e);
                transcriptionText = `(Transcription Failed: ${e.message})`;
            }

            // 4. Save to DB
            // Note: audio_url is placeholder since we have no R2 yet.
            const result = await c.env.DB.prepare(`
                INSERT INTO events (telegram_file_id, audio_url, transcription, raw_metadata) 
                VALUES (?, ?, ?, ?)
                RETURNING id
            `).bind(fileId, audioUrl, transcriptionText, JSON.stringify(message)).first();

            const eventId = result?.id;

            // 5. EXTRACT MEANING (AI)
            if (eventId && transcriptionText && transcriptionText.length > 5) {
                // Run in background (ctx.waitUntil) or await? Webhook needs fast reply.
                // For MVP we await, but warn about timeouts.
                try {
                    const systemPrompt = `You are an AI assistant parsing daily life voice notes. Extract meaningful structured data.
                    Return ONLY a raw JSON object (no markdown formatting).
                    Structure:
                    {
                        "summary": "Concise 1-sentence summary",
                        "category": "One of: Work, Personal, Health, Finance, Idea, Shopping, Social, Other",
                        "importance": "Low/Medium/High",
                        "entities": {
                            "people": ["names..."],
                            "money": ["amounts..."],
                            "dates": ["times/dates..."],
                            "locations": ["places..."]
                        }
                    }`;

                    const aiResponse: any = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: transcriptionText }
                        ]
                    });

                    let responseText = aiResponse.response || "";
                    // Clean up potential markdown code blocks
                    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

                    const start = responseText.indexOf('{');
                    const end = responseText.lastIndexOf('}');

                    if (start >= 0 && end > start) {
                        const jsonStr = responseText.substring(start, end + 1);
                        const data = JSON.parse(jsonStr);

                        // Save to event_data
                        const batch = [
                            c.env.DB.prepare('INSERT INTO event_data (event_id, key, value) VALUES (?, ?, ?)').bind(eventId, 'summary', data.summary || ""),
                            c.env.DB.prepare('INSERT INTO event_data (event_id, key, value) VALUES (?, ?, ?)').bind(eventId, 'category', data.category || "Other"),
                            c.env.DB.prepare('INSERT INTO event_data (event_id, key, value) VALUES (?, ?, ?)').bind(eventId, 'importance', data.importance || "Low"),
                            c.env.DB.prepare('INSERT INTO event_data (event_id, key, value) VALUES (?, ?, ?)').bind(eventId, 'entities', JSON.stringify(data.entities || {}))
                        ];

                        await c.env.DB.batch(batch);
                        await c.env.DB.prepare('UPDATE events SET processed = 1 WHERE id = ?').bind(eventId).run();
                    }

                } catch (e: any) {
                    console.error("Extraction Error:", e);
                    // Don't fail the whole request, just log
                }
            }

            // 5. Reply
            let reply = `📝 <b>Transcription:</b>\n\n${transcriptionText}`;
            if (transcriptionText.length > 3000) reply = reply.substring(0, 3000) + "..."; // TG limit

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'HTML' })
            });

            // Trigger "Extraction" (Future Step) in background?
            // For now, we simple saved it.

        } catch (e: any) {
            console.error(e);
            await sendTelegramReply(token, chatId, `❌ Error processing audio: ${e.message}`);
        }
    } else {
        await sendTelegramReply(token, chatId, "Please send a Voice message.");
    }

    return c.json({ ok: true });
});

export default app;
