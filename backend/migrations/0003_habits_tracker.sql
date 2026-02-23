-- Migration number: 0003   2026-01-12
-- Habit Tracker Feature: Habits per person with daily check-ins

-- Habits table - define habits that can be tracked per person
CREATE TABLE habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL, -- Each habit belongs to a person
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT DEFAULT 'daily', -- daily, weekly, custom
    target_count INTEGER DEFAULT 1, -- How many times per frequency period
    icon TEXT DEFAULT '✓', -- Emoji or icon for display
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- Habit logs - track when habits are completed
CREATE TABLE habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL, -- Denormalized for easier queries
    log_date DATE NOT NULL, -- The date this log is for
    completed BOOLEAN DEFAULT 0,
    count INTEGER DEFAULT 0, -- For habits that can be done multiple times
    note TEXT, -- Optional note (can be from voice transcription)
    voice_url TEXT, -- Optional voice recording URL
    transcription TEXT, -- Transcribed voice note
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
    UNIQUE(habit_id, log_date) -- One log per habit per day
);

-- Create indexes for common queries
CREATE INDEX idx_habits_person_id ON habits(person_id);
CREATE INDEX idx_habits_is_active ON habits(is_active);
CREATE INDEX idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX idx_habit_logs_person_id ON habit_logs(person_id);
CREATE INDEX idx_habit_logs_log_date ON habit_logs(log_date);
CREATE INDEX idx_habit_logs_person_date ON habit_logs(person_id, log_date);

-- Default habits template (will be created per person when they're added)
-- These are common daily habits that most people track
CREATE TABLE default_habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '✓',
    color TEXT DEFAULT '#3b82f6',
    category TEXT DEFAULT 'Health', -- Health, Wellness, Medication, Exercise, etc.
    sort_order INTEGER DEFAULT 0
);

-- Insert default habit templates
INSERT INTO default_habits (name, description, icon, color, category, sort_order) VALUES
    ('Morning Medicine', 'Take morning medications', '💊', '#ef4444', 'Medication', 1),
    ('Evening Medicine', 'Take evening medications', '💊', '#ef4444', 'Medication', 2),
    ('Blood Pressure Check', 'Check and record blood pressure', '❤️', '#dc2626', 'Health', 3),
    ('Blood Sugar Check', 'Check blood glucose level', '🩸', '#f97316', 'Health', 4),
    ('Exercise', 'Physical activity or walk', '🏃', '#22c55e', 'Exercise', 5),
    ('Water Intake', 'Drink 8 glasses of water', '💧', '#0ea5e9', 'Wellness', 6),
    ('Healthy Meal', 'Ate a balanced meal', '🥗', '#84cc16', 'Nutrition', 7),
    ('Sleep 8 Hours', 'Got adequate sleep', '😴', '#8b5cf6', 'Wellness', 8),
    ('Vitamins', 'Take daily vitamins/supplements', '💎', '#f59e0b', 'Medication', 9),
    ('Meditation', 'Mindfulness or meditation practice', '🧘', '#06b6d4', 'Wellness', 10);
