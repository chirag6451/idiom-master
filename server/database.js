import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'figuroai.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    idiom TEXT NOT NULL,
    language TEXT NOT NULL,
    meaning TEXT NOT NULL,
    history TEXT NOT NULL,
    examples TEXT NOT NULL,
    audio_url TEXT,
    saved_at INTEGER NOT NULL,
    UNIQUE(user_id, idiom, language)
  );

  CREATE INDEX IF NOT EXISTS idx_user_favorites ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_saved_at ON favorites(saved_at DESC);
`);

console.log('✅ Database initialized');

export default db;
