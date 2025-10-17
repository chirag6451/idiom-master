/**
 * Favorites API Service - Connects to backend for cross-device sync
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface FavoriteData {
  idiom: string;
  language: string;
  meaning: string;
  history: string;
  examples: string[];
  audio_url?: string;
  saved_at: number;
}

/**
 * Fetch all favorites for a user from backend
 */
export async function fetchUserFavorites(userId: string): Promise<FavoriteData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/favorites/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`✅ Fetched ${data.favorites.length} favorites from server`);
    return data.favorites;
  } catch (error) {
    console.error('❌ Error fetching favorites:', error);
    throw error;
  }
}

/**
 * Save a favorite to backend (with audio upload to S3)
 */
export async function saveFavoriteToBackend(
  userId: string,
  idiom: string,
  language: string,
  info: { meaning: string; history: string; examples: string[] },
  audioData?: string
): Promise<{ success: boolean; audioUrl?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        idiom,
        language,
        info,
        audioData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Favorite saved to server: ${idiom}`);
    return data;
  } catch (error) {
    console.error('❌ Error saving favorite:', error);
    throw error;
  }
}

/**
 * Delete a favorite from backend (and S3)
 */
export async function deleteFavoriteFromBackend(
  userId: string,
  idiom: string,
  language: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/favorites/${userId}/${encodeURIComponent(idiom)}/${encodeURIComponent(language)}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`✅ Favorite deleted from server: ${idiom}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting favorite:', error);
    throw error;
  }
}

/**
 * Sync local favorites with server (merge strategy)
 */
export async function syncFavorites(
  userId: string,
  localFavorites: FavoriteData[]
): Promise<FavoriteData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/favorites/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        localFavorites,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Synced favorites: ${data.favorites.length} total`);
    return data.favorites;
  } catch (error) {
    console.error('❌ Error syncing favorites:', error);
    throw error;
  }
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    console.warn('⚠️ Backend not available, using local storage only');
    return false;
  }
}
