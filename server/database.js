import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_FILE = join(__dirname, 'figuroai-db.json');

// Initialize database file
if (!existsSync(DB_FILE)) {
  writeFileSync(DB_FILE, JSON.stringify({ favorites: [] }, null, 2));
}

// Simple JSON database
class JsonDatabase {
  constructor() {
    this.load();
  }

  load() {
    try {
      const data = readFileSync(DB_FILE, 'utf8');
      this.data = JSON.parse(data);
    } catch (error) {
      this.data = { favorites: [] };
    }
  }

  save() {
    writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
  }

  // Get all favorites for a user
  getFavorites(userId) {
    return this.data.favorites
      .filter(f => f.user_id === userId)
      .sort((a, b) => b.saved_at - a.saved_at)
      .slice(0, 50);
  }

  // Add or update a favorite
  addFavorite(favorite) {
    // Remove existing if present
    this.data.favorites = this.data.favorites.filter(
      f => !(f.user_id === favorite.user_id && f.idiom === favorite.idiom && f.language === favorite.language)
    );
    
    // Add new
    this.data.favorites.push({
      id: Date.now(),
      ...favorite
    });
    
    this.save();
    return favorite;
  }

  // Delete a favorite
  deleteFavorite(userId, idiom, language) {
    const favorite = this.data.favorites.find(
      f => f.user_id === userId && f.idiom === idiom && f.language === language
    );
    
    this.data.favorites = this.data.favorites.filter(
      f => !(f.user_id === userId && f.idiom === idiom && f.language === language)
    );
    
    this.save();
    return favorite;
  }
}

const db = new JsonDatabase();

console.log('✅ JSON Database initialized');

export default db;
