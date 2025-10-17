# FiguroAI Backend API

Simple Express backend with SQLite database and AWS S3 storage for cross-device favorites sync.

## Features

- ✅ SQLite database for favorites metadata
- ✅ AWS S3 for audio file storage
- ✅ Cross-device sync
- ✅ RESTful API
- ✅ Up to 50 favorites per user

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure AWS S3

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your AWS credentials:

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=figuroai-audio
```

### 3. Create S3 Bucket

1. Go to AWS S3 Console
2. Create bucket named `figuroai-audio` (or your chosen name)
3. Enable public access for audio files
4. Add CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### 4. Start Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

Server will run on http://localhost:3001

## API Endpoints

### Health Check
```
GET /api/health
```

### Get User Favorites
```
GET /api/favorites/:userId
```

### Add Favorite
```
POST /api/favorites
Body: {
  userId: string,
  idiom: string,
  language: string,
  info: { meaning, history, examples },
  audioData: string (base64)
}
```

### Delete Favorite
```
DELETE /api/favorites/:userId/:idiom/:language
```

### Sync Favorites
```
POST /api/favorites/sync
Body: {
  userId: string,
  localFavorites: []
}
```

## Database Schema

```sql
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  idiom TEXT NOT NULL,
  language TEXT NOT NULL,
  meaning TEXT NOT NULL,
  history TEXT NOT NULL,
  examples TEXT NOT NULL,
  audio_url TEXT,
  saved_at INTEGER NOT NULL
);
```

## Storage Structure

- **SQLite**: Favorites metadata (text data)
- **S3**: Audio files at `audio/{userId}/{idiom}_{timestamp}.mp3`

## Security Notes

- Passwords are hashed with SHA-256
- S3 files are public-read (for audio playback)
- Add authentication middleware for production
- Use HTTPS in production
