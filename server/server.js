import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import db from './database.js';
import { uploadAudioToS3, deleteAudioFromS3 } from './s3Service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Large limit for audio data
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FiguroAI Backend API' });
});

// Get all favorites for a user
app.get('/api/favorites/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const stmt = db.prepare(`
      SELECT id, idiom, language, meaning, history, examples, audio_url, saved_at
      FROM favorites
      WHERE user_id = ?
      ORDER BY saved_at DESC
      LIMIT 50
    `);
    
    const favorites = stmt.all(userId);
    
    // Parse examples JSON
    const parsed = favorites.map(fav => ({
      ...fav,
      examples: JSON.parse(fav.examples)
    }));
    
    console.log(`✅ Retrieved ${parsed.length} favorites for user ${userId}`);
    res.json({ favorites: parsed });
  } catch (error) {
    console.error('❌ Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add a favorite
app.post('/api/favorites', async (req, res) => {
  try {
    const { userId, idiom, language, info, audioData } = req.body;
    
    if (!userId || !idiom || !language || !info) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Upload audio to S3 if provided
    let audioUrl = null;
    if (audioData) {
      try {
        audioUrl = await uploadAudioToS3(userId, idiom, audioData);
      } catch (error) {
        console.warn('⚠️ Audio upload failed, saving without audio:', error.message);
      }
    }
    
    // Insert into database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO favorites 
      (user_id, idiom, language, meaning, history, examples, audio_url, saved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      userId,
      idiom,
      language,
      info.meaning,
      info.history,
      JSON.stringify(info.examples),
      audioUrl,
      Date.now()
    );
    
    console.log(`✅ Favorite saved for user ${userId}: ${idiom}`);
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      audioUrl 
    });
  } catch (error) {
    console.error('❌ Error saving favorite:', error);
    res.status(500).json({ error: 'Failed to save favorite' });
  }
});

// Delete a favorite
app.delete('/api/favorites/:userId/:idiom/:language', async (req, res) => {
  try {
    const { userId, idiom, language } = req.params;
    
    // Get audio URL before deleting
    const stmt = db.prepare(`
      SELECT audio_url FROM favorites 
      WHERE user_id = ? AND idiom = ? AND language = ?
    `);
    const favorite = stmt.get(userId, idiom, language);
    
    // Delete from S3 if audio exists
    if (favorite?.audio_url) {
      try {
        await deleteAudioFromS3(favorite.audio_url);
      } catch (error) {
        console.warn('⚠️ Audio deletion failed:', error.message);
      }
    }
    
    // Delete from database
    const deleteStmt = db.prepare(`
      DELETE FROM favorites 
      WHERE user_id = ? AND idiom = ? AND language = ?
    `);
    deleteStmt.run(userId, idiom, language);
    
    console.log(`✅ Favorite deleted for user ${userId}: ${idiom}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting favorite:', error);
    res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

// Sync favorites (merge local with server)
app.post('/api/favorites/sync', async (req, res) => {
  try {
    const { userId, localFavorites } = req.body;
    
    // Get server favorites
    const stmt = db.prepare(`
      SELECT idiom, language, meaning, history, examples, audio_url, saved_at
      FROM favorites
      WHERE user_id = ?
    `);
    const serverFavorites = stmt.all(userId);
    
    // Merge logic: server wins for conflicts, add new local ones
    const merged = [...serverFavorites];
    const serverKeys = new Set(serverFavorites.map(f => `${f.idiom}_${f.language}`));
    
    for (const local of localFavorites) {
      const key = `${local.idiom}_${local.language}`;
      if (!serverKeys.has(key)) {
        merged.push(local);
      }
    }
    
    console.log(`✅ Synced favorites for user ${userId}: ${merged.length} total`);
    res.json({ favorites: merged });
  } catch (error) {
    console.error('❌ Error syncing favorites:', error);
    res.status(500).json({ error: 'Failed to sync favorites' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FiguroAI Backend running on port ${PORT}`);
  console.log(`📊 Database: SQLite`);
  console.log(`☁️  Storage: AWS S3`);
});
