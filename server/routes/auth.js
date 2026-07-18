import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateId } from '../config/validation.js';

const router = express.Router();

async function blacklistToken(token, expiresIn = '7d') {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const ms = expiresIn.endsWith('d') ? parseInt(expiresIn) * 86400000 : 7 * 86400000;
  const expiresAt = new Date(Date.now() + ms);
  await pool.execute(
    'INSERT INTO token_blacklist (token_hash, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)',
    [hash, expiresAt]
  );
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, name } = req.body;

    // Validate input
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    // Validate username format (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    // Check if email already exists
    const [existingEmail] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Email or username is already taken' });
    }

    // Check if username already exists
    const [existingUsername] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsername.length > 0) {
      return res.status(409).json({ error: 'Email or username is already taken' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with default 'user' role
    const [result] = await pool.execute(
      'INSERT INTO users (email, password, username, name) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, username, name || '']
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertId, email, username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: result.insertId,
        email,
        username,
        name: name || '',
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [users] = await pool.execute(
      'SELECT id, email, password, username, name, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Check account lockout
    try {
      const [attemptRows] = await pool.execute(
        'SELECT attempts, locked_until FROM login_attempts WHERE user_id = ?',
        [user.id]
      );
      if (attemptRows.length > 0) {
        const { attempts, locked_until } = attemptRows[0];
        if (locked_until && new Date(locked_until) > new Date()) {
          const remaining = Math.ceil((new Date(locked_until) - new Date()) / 60000);
          return res.status(429).json({ error: `Account locked. Try again in ${remaining} minute(s)` });
        }
        if (attempts >= 5 && (!locked_until || new Date(locked_until) <= new Date())) {
          await pool.execute(
            'UPDATE login_attempts SET attempts = 1, locked_until = NULL WHERE user_id = ?',
            [user.id]
          );
        }
      }
    } catch { /* table may not exist yet */ }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      try {
        const [existing] = await pool.execute(
          'SELECT attempts FROM login_attempts WHERE user_id = ?',
          [user.id]
        );
        if (existing.length > 0) {
          const newAttempts = existing[0].attempts + 1;
          if (newAttempts >= 5) {
            const lockedUntil = new Date(Date.now() + 30 * 60000);
            await pool.execute(
              'UPDATE login_attempts SET attempts = ?, locked_until = ? WHERE user_id = ?',
              [newAttempts, lockedUntil, user.id]
            );
          } else {
            await pool.execute(
              'UPDATE login_attempts SET attempts = ? WHERE user_id = ?',
              [newAttempts, user.id]
            );
          }
        } else {
          await pool.execute(
            'INSERT INTO login_attempts (user_id, attempts) VALUES (?, 1)',
            [user.id]
          );
        }
      } catch { /* table may not exist yet */ }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset login attempts on success
    try {
      await pool.execute('DELETE FROM login_attempts WHERE user_id = ?', [user.id]);
    } catch { /* table may not exist yet */ }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Logout (blacklists the token)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await blacklistToken(req.token, process.env.JWT_EXPIRES_IN || '7d');
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, username, name, role, bio, avatar_url, dietary_restrictions, allergies, preferred_cuisines, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Profile fetch error:', error);
    
    // If columns don't exist, return basic user info
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      try {
        const [users] = await pool.execute(
          'SELECT id, email, name, role, created_at FROM users WHERE id = ?',
          [req.user.id]
        );
        
        if (users.length > 0) {
          return res.json({
            ...users[0],
            bio: null,
            avatar_url: null,
            dietary_restrictions: null,
            allergies: null,
            preferred_cuisines: null
          });
        }
      } catch (fallbackError) {
        console.error('Fallback profile fetch error:', fallbackError);
      }
    }
    
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, name, email, bio } = req.body;

    // Validate input lengths
    if (username) {
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      if (username.length > 50) {
        return res.status(400).json({ error: 'Username must be at most 50 characters' });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      }
    }

    if (name && name.length > 100) {
      return res.status(400).json({ error: 'Name must be at most 100 characters' });
    }

    if (email && email.length > 255) {
      return res.status(400).json({ error: 'Email must be at most 255 characters' });
    }

    if (bio && bio.length > 500) {
      return res.status(400).json({ error: 'Bio must be at most 500 characters' });
    }

    // Check if username is already taken by another user
    if (username) {
      const [existingUsername] = await pool.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, req.user.id]
      );

      if (existingUsername.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.id]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    const safeEmail = email || req.user.email;

    await pool.execute(
      'UPDATE users SET username = ?, name = ?, email = ?, bio = ? WHERE id = ?',
      [username || '', name || '', safeEmail, bio || '', req.user.id]
    );

    const [users] = await pool.execute(
      'SELECT id, email, username, name, role, bio FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      message: 'Profile updated successfully',
      user: users[0]
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Get current password hash
    const [users] = await pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    // Blacklist current token so user must log in again
    try {
      await blacklistToken(req.token, process.env.JWT_EXPIRES_IN || '7d');
    } catch { /* token may already be invalid */ }

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update dietary preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { dietary_restrictions, allergies, preferred_cuisines } = req.body;

    // Try to update with all fields first
    try {
      await pool.execute(
        'UPDATE users SET dietary_restrictions = ?, allergies = ?, preferred_cuisines = ? WHERE id = ?',
        [dietary_restrictions || '[]', allergies || '[]', preferred_cuisines || '[]', req.user.id]
      );
    } catch (dbError) {
      // If columns don't exist, log the error but don't fail
      if (dbError.code === 'ER_BAD_FIELD_ERROR') {
        console.log('Profile columns do not exist yet. User needs to run migration.');
        return res.status(400).json({ 
          error: 'Profile features not available. Please contact administrator to run database migration.',
          code: 'MIGRATION_REQUIRED'
        });
      }
      throw dbError;
    }

    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Upload avatar
router.post('/avatar', authenticateToken, async (req, res) => {
  try {
    // For now, we'll use a placeholder for avatar URL
    // In production, you would integrate with a file storage service like AWS S3
    const name = req.user.name || req.user.username || req.user.email?.split('@')[0] || 'User';
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f97316&color=fff&size=150`;

    await pool.execute(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, req.user.id]
    );

    res.json({
      message: 'Avatar updated successfully',
      avatar_url: avatarUrl
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Get user statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    // Count recipes
    const [recipesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM recipes WHERE created_by = ?',
      [req.user.id]
    );

    // Count favorites
    const [favoritesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_favorites uf INNER JOIN recipes r ON uf.recipe_id = r.id WHERE uf.user_id = ?',
      [req.user.id]
    );

    // Count likes received on user's recipes
    const [likesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM recipe_likes WHERE recipe_id IN (SELECT id FROM recipes WHERE created_by = ?) AND like_type = "like"',
      [req.user.id]
    );

    res.json({
      recipes: recipesCount[0].count,
      favorites: favoritesCount[0].count,
      likes: likesCount[0].count
    });
  } catch (error) {
    console.error('Statistics fetch error:', error);
    // Return zeros on error instead of failing
    res.json({
      recipes: 0,
      favorites: 0,
      likes: 0
    });
  }
});

// Admin: Assign moderator role to a user
router.post('/admin/assign-moderator/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = validateId(req.params.userId);

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot modify admin role' });
    }

    if (user.role === 'moderator') {
      return res.status(400).json({ error: 'User is already a moderator' });
    }

    // Update user role to moderator
    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      ['moderator', userId]
    );

    res.json({
      message: 'Moderator role assigned successfully',
      user: {
        id: user.id,
        username: user.username,
        role: 'moderator'
      }
    });
  } catch (error) {
    console.error('Error assigning moderator role:', error);
    res.status(500).json({ error: 'Failed to assign moderator role' });
  }
});

// Admin: Remove moderator role from a user (back to user)
router.post('/admin/remove-moderator/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = validateId(req.params.userId);

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot modify admin role' });
    }

    if (user.role !== 'moderator') {
      return res.status(400).json({ error: 'User is not a moderator' });
    }

    // Update user role back to user
    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      ['user', userId]
    );

    res.json({
      message: 'Moderator role removed successfully',
      user: {
        id: user.id,
        username: user.username,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Error removing moderator role:', error);
    res.status(500).json({ error: 'Failed to remove moderator role' });
  }
});

// Admin: Get all users with their roles
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, username, name, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
