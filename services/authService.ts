/**
 * Simple authentication service with hashed passwords
 * Note: For production, use proper backend authentication
 */

// Simple hash function (for demo - in production use proper crypto)
async function simpleHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// User database (passwords are hashed)
// In production, this should be on a secure backend
const USERS = [
  {
    id: '1',
    username: 'admin',
    // Password: admin123
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    name: 'Admin User',
    email: 'admin@figuroai.com'
  },
  {
    id: '2',
    username: 'demo',
    // Password: demo123
    passwordHash: 'c3499c2729730a7f807efb8676a92dcb6f8a3f8f0528583e8e1e6e8e5e8e5e8e',
    name: 'Demo User',
    email: 'demo@figuroai.com'
  },
  {
    id: '3',
    username: 'chirag',
    // Password: chirag123
    passwordHash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    name: 'Chirag Kansara',
    email: 'chirag@figuroai.com'
  }
];

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  try {
    // Hash the provided password
    const passwordHash = await simpleHash(password);
    
    // Find user with matching username and password hash
    const user = USERS.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === passwordHash
    );
    
    if (user) {
      // Return user without password hash
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email
      };
    }
    
    return null;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export function getCurrentUser(): User | null {
  try {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      return JSON.parse(userJson);
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export function saveCurrentUser(user: User): void {
  try {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } catch (error) {
    console.error('Error saving current user:', error);
  }
}

export function logout(): void {
  localStorage.removeItem('currentUser');
}

// Helper to generate password hash (for adding new users)
export async function generatePasswordHash(password: string): Promise<string> {
  return await simpleHash(password);
}
