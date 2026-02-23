-- Migration number: 0004 	 2026-01-12
-- Add password authentication to users table

-- Add password_hash column
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Add name column for display
ALTER TABLE users ADD COLUMN name TEXT;

-- Insert default admin user with password
INSERT OR IGNORE INTO users (email, name, password_hash)
VALUES ('admin@twozao.com', 'Admin', 'KEMozhi@2025nc');
