-- Migration number: 0001 	 2026-01-10T00:00:00.000Z
-- Table for storing Voice Events
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_file_id TEXT, -- Original Telegram ID
    audio_url TEXT, -- R2 or caching URL
    transcription TEXT, -- The text transcribed from voice
    raw_metadata TEXT, -- JSON blob for full telegram message mainly
    processed BOOLEAN DEFAULT 0, -- If we have extracted data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Extracted Key-Value Info (The "More than one relationship table")
CREATE TABLE event_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    key TEXT,
    value TEXT,
    confidence REAL, -- Optional: AI confidence score
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Existing tables we might keep for Admin Auth (Users)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  magic_link_token TEXT,
  magic_link_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Debug logs are useful
CREATE TABLE telegram_debug_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sender TEXT,
    payload TEXT
);
