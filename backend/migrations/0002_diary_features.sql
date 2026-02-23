-- Migration number: 0002   2026-01-12
-- Personal Diary Features: Notes, Tags, People, Photos

-- People table - for tracking family members or contacts
CREATE TABLE people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relationship TEXT, -- e.g., 'spouse', 'child', 'parent', 'sibling', 'friend'
    notes TEXT, -- Additional info about the person
    avatar_url TEXT, -- Optional photo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags table - user-defined tags for categorization
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6', -- Hex color for display
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes table - main diary entries
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT NOT NULL, -- The main note content
    category TEXT DEFAULT 'General', -- Health, Prescription, Personal, Family, Medical, Appointment, etc.
    importance TEXT DEFAULT 'Low', -- Low, Medium, High
    event_date DATE, -- The actual date the event occurred (may differ from created_at)
    event_id INTEGER, -- Optional link to voice recording event
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- Note-People junction table - link notes to people
CREATE TABLE note_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    role TEXT, -- e.g., 'patient', 'caregiver', 'mentioned'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
    UNIQUE(note_id, person_id)
);

-- Note-Tags junction table - link notes to tags
CREATE TABLE note_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(note_id, tag_id)
);

-- Photos table - attachments for notes
CREATE TABLE note_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL,
    photo_url TEXT NOT NULL, -- R2 storage URL
    caption TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX idx_notes_category ON notes(category);
CREATE INDEX idx_notes_event_date ON notes(event_date);
CREATE INDEX idx_notes_importance ON notes(importance);
CREATE INDEX idx_note_people_note_id ON note_people(note_id);
CREATE INDEX idx_note_people_person_id ON note_people(person_id);
CREATE INDEX idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX idx_note_photos_note_id ON note_photos(note_id);

-- Insert some default tags
INSERT INTO tags (name, color) VALUES
    ('Medical', '#ef4444'),
    ('Prescription', '#f97316'),
    ('Appointment', '#eab308'),
    ('Family', '#22c55e'),
    ('Health', '#06b6d4'),
    ('Emergency', '#dc2626'),
    ('Follow-up', '#8b5cf6'),
    ('Insurance', '#6366f1');

-- Insert some default categories (for reference, categories are stored in notes directly)
-- Categories: Health, Medical, Prescription, Appointment, Personal, Family, Work, Financial, Other
