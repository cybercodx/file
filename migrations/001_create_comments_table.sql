-- Migration number: 0001
DROP TABLE IF EXISTS files;
CREATE TABLE files (
    code TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    file_type TEXT NOT NULL,
    caption TEXT,
    created_at INTEGER,
    views INTEGER DEFAULT 0
);
