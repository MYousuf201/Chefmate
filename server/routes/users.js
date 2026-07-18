import express from 'express';
import { pool } from '../config/database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateId } from '../config/validation.js';

const router = express.Router();

// Get user profile by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const userId = req.user?.id;

    // Get user profile
    const [users] = await pool.execute(
      `SELECT id, username, name, role, bio, avatar_url, created_at 
       FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Get follower/following counts
    const [followerCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?',
      [id]
    );
    
    const [followingCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?',
      [id]
    );

    // Get recipe count
    const [recipeCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM recipes WHERE created_by = ?',
      [id]
    );

    // Check if current user is following this user
    let isFollowing = false;
    if (userId) {
      const [follows] = await pool.execute(
        'SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?',
        [userId, id]
      );
      isFollowing = follows.length > 0;
    }

    res.json({
      user: {
        ...user,
        followerCount: followerCount[0].count,
        followingCount: followingCount[0].count,
        recipeCount: recipeCount[0].count,
        isFollowing
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get user's recipes
router.get('/:id/recipes', optionalAuth, async (req, res) => {
  try {
    const id = validateId(req.params.id);

    const [recipes] = await pool.execute(
      `SELECT r.*, u.username as creator_username, u.name as creator_name
       FROM recipes r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.created_by = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    const parsedRecipes = recipes.map(recipe => {
      let ingredients = [];
      let instructions = [];

      try {
        ingredients = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
      } catch {
        ingredients = [];
      }

      try {
        instructions = recipe.instructions ? JSON.parse(recipe.instructions) : [];
      } catch {
        instructions = [];
      }

      return {
        ...recipe,
        ingredients,
        instructions
      };
    });

    res.json(parsedRecipes);

  } catch (error) {
    console.error('Error fetching user recipes:', error);
    res.status(500).json({ error: 'Failed to fetch user recipes' });
  }
});

// Follow a user
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const followingId = validateId(req.params.id);
    const followerId = req.user.id;

    // Can't follow yourself
    if (parseInt(followingId) === followerId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [followingId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const [existing] = await pool.execute(
      'SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    await pool.execute(
      'INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)',
      [followerId, followingId]
    );

    res.json({ message: 'Successfully followed user' });

  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const followingId = validateId(req.params.id);
    const followerId = req.user.id;

    const [result] = await pool.execute(
      'DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    res.json({ message: 'Successfully unfollowed user' });

  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get user's followers
router.get('/:id/followers', optionalAuth, async (req, res) => {
  try {
    const id = validateId(req.params.id);

    const [followers] = await pool.execute(
      `SELECT u.id, u.username, u.name, u.avatar_url, u.bio
       FROM user_follows uf
       JOIN users u ON uf.follower_id = u.id
       WHERE uf.following_id = ?
       ORDER BY uf.created_at DESC`,
      [id]
    );

    res.json(followers);

  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get user's following
router.get('/:id/following', optionalAuth, async (req, res) => {
  try {
    const id = validateId(req.params.id);

    const [following] = await pool.execute(
      `SELECT u.id, u.username, u.name, u.avatar_url, u.bio
       FROM user_follows uf
       JOIN users u ON uf.following_id = u.id
       WHERE uf.follower_id = ?
       ORDER BY uf.created_at DESC`,
      [id]
    );

    res.json(following);

  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

export default router;
