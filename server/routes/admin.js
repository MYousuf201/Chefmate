import express from 'express';
import { pool } from '../config/database.js';
import { authenticateToken, requireAdmin, requireModerator } from '../middleware/auth.js';
import { validateId } from '../config/validation.js';

const router = express.Router();

// ==================== ANALYTICS & METRICS ====================

// Get system statistics (Admin & Moderator)
router.get('/stats', authenticateToken, requireModerator, async (req, res) => {
  try {
    // User statistics
    const [totalUsers] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const [newUsersToday] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()'
    );
    const [newUsersWeek] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    const [activeUsers] = await pool.execute(
      'SELECT COUNT(DISTINCT user_id) as count FROM notifications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    // Recipe statistics
    const [totalRecipes] = await pool.execute('SELECT COUNT(*) as count FROM recipes');
    const [recipesToday] = await pool.execute(
      'SELECT COUNT(*) as count FROM recipes WHERE DATE(created_at) = CURDATE()'
    );
    const [recipesWeek] = await pool.execute(
      'SELECT COUNT(*) as count FROM recipes WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    // Engagement statistics
    const [totalComments] = await pool.execute('SELECT COUNT(*) as count FROM recipe_comments');
    const [totalRatings] = await pool.execute('SELECT COUNT(*) as count FROM recipe_ratings');
    const [totalLikes] = await pool.execute('SELECT COUNT(*) as count FROM recipe_likes');
    const [commentsToday] = await pool.execute(
      'SELECT COUNT(*) as count FROM recipe_comments WHERE DATE(created_at) = CURDATE()'
    );

    // Role distribution
    const [roleStats] = await pool.execute(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);

    // Average rating
    const [avgRating] = await pool.execute(
      'SELECT AVG(rating) as average FROM recipe_ratings'
    );

    res.json({
      users: {
        total: totalUsers[0].count,
        today: newUsersToday[0].count,
        thisWeek: newUsersWeek[0].count,
        active: activeUsers[0].count,
        byRole: roleStats
      },
      recipes: {
        total: totalRecipes[0].count,
        today: recipesToday[0].count,
        thisWeek: recipesWeek[0].count
      },
      engagement: {
        comments: totalComments[0].count,
        ratings: totalRatings[0].count,
        likes: totalLikes[0].count,
        commentsToday: commentsToday[0].count,
        averageRating: avgRating[0].average ? parseFloat(avgRating[0].average).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get activity timeline (Admin & Moderator)
router.get('/activity', authenticateToken, requireModerator, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 50));
    
    const [activities] = await pool.query(`
      SELECT * FROM (
        SELECT 'user_registered' as type, u.id as user_id, u.username, u.created_at as timestamp
        FROM users u
        UNION ALL
        SELECT 'recipe_created' as type, r.created_by as user_id, u.username, r.created_at as timestamp
        FROM recipes r
        JOIN users u ON r.created_by = u.id
        UNION ALL
        SELECT 'comment_posted' as type, c.user_id, u.username, c.created_at as timestamp
        FROM recipe_comments c
        JOIN users u ON c.user_id = u.id
        UNION ALL
        SELECT 'recipe_rated' as type, rr.user_id, u.username, rr.created_at as timestamp
        FROM recipe_ratings rr
        JOIN users u ON rr.user_id = u.id
      ) AS combined
      ORDER BY timestamp DESC
      LIMIT ?
    `, [limit]);

    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get top users (Admin & Moderator)
router.get('/top-users', authenticateToken, requireModerator, async (req, res) => {
  try {
    const [topCreators] = await pool.execute(`
      SELECT u.id, u.username, u.avatar_url, COUNT(r.id) as recipe_count
      FROM users u
      LEFT JOIN recipes r ON u.id = r.created_by
      GROUP BY u.id
      ORDER BY recipe_count DESC
      LIMIT 10
    `);

    const [topRaters] = await pool.execute(`
      SELECT u.id, u.username, u.avatar_url, COUNT(rr.id) as rating_count
      FROM users u
      LEFT JOIN recipe_ratings rr ON u.id = rr.user_id
      GROUP BY u.id
      ORDER BY rating_count DESC
      LIMIT 10
    `);

    const [topCommenters] = await pool.execute(`
      SELECT u.id, u.username, u.avatar_url, COUNT(c.id) as comment_count
      FROM users u
      LEFT JOIN recipe_comments c ON u.id = c.user_id
      GROUP BY u.id
      ORDER BY comment_count DESC
      LIMIT 10
    `);

    res.json({
      topCreators,
      topRaters,
      topCommenters
    });
  } catch (error) {
    console.error('Error fetching top users:', error);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

// ==================== USER MANAGEMENT ====================

// Get all users with filters (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, role, sortBy = 'created_at', order = 'DESC', limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT u.id, u.username, u.name, u.email, u.role, u.created_at, u.avatar_url,
        COALESCE(us.status, 'active') as status,
        (SELECT COUNT(*) FROM recipes WHERE created_by = u.id) as recipe_count,
        (SELECT COUNT(*) FROM recipe_comments WHERE user_id = u.id) as comment_count,
        (SELECT COUNT(*) FROM recipe_ratings WHERE user_id = u.id) as rating_count
      FROM users u
      LEFT JOIN user_status us ON u.id = us.user_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    const validSortColumns = ['created_at', 'username', 'email', 'role'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const limitVal = Math.max(1, Math.min(500, parseInt(limit) || 100));
    const offsetVal = Math.max(0, parseInt(offset) || 0);

    query += ` ORDER BY u.${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limitVal, offsetVal);

    const [users] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users u WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.name LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (role) {
      countQuery += ' AND u.role = ?';
      countParams.push(role);
    }

    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      users,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details with full activity (Admin only)
router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = validateId(req.params.userId);

    // Get user info
    const [users] = await pool.execute(`
      SELECT id, username, name, email, role, bio, avatar_url, created_at
      FROM users WHERE id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Get user recipes
    const [recipes] = await pool.execute(`
      SELECT id, title, created_at, 
        (SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = recipes.id) as likes,
        (SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = recipes.id) as comments
      FROM recipes WHERE created_by = ?
      ORDER BY created_at DESC
    `, [userId]);

    // Get user comments
    const [comments] = await pool.execute(`
      SELECT c.id, c.comment_text as content, c.created_at, r.id as recipe_id, r.title as recipe_title
      FROM recipe_comments c
      JOIN recipes r ON c.recipe_id = r.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
      LIMIT 20
    `, [userId]);

    // Get user ratings
    const [ratings] = await pool.execute(`
      SELECT rr.rating, rr.tried_it, rr.review_comment, rr.created_at, 
        r.id as recipe_id, r.title as recipe_title
      FROM recipe_ratings rr
      JOIN recipes r ON rr.recipe_id = r.id
      WHERE rr.user_id = ?
      ORDER BY rr.created_at DESC
      LIMIT 20
    `, [userId]);

    // Get follower/following counts
    const [followerCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?',
      [userId]
    );
    const [followingCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?',
      [userId]
    );

    res.json({
      user: {
        ...user,
        followers: followerCount[0].count,
        following: followingCount[0].count
      },
      recipes,
      comments,
      ratings
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user account status (Admin only)
router.patch('/users/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = validateId(req.params.userId);
    const { status } = req.body; // 'active', 'suspended', 'banned'

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if user exists and is not admin
    const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (users[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot modify admin status' });
    }

    // Add status column if it doesn't exist (for future use)
    // For now, we'll use a separate table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_status (
        user_id INT PRIMARY KEY,
        status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await pool.execute(`
      INSERT INTO user_status (user_id, status) 
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE status = ?, updated_at = CURRENT_TIMESTAMP
    `, [userId, status, status]);

    res.json({ 
      message: 'User status updated successfully',
      userId,
      status
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete user account (Admin only)
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = validateId(req.params.userId);

    // Check if user exists and is not admin
    const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (users[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin account' });
    }

    // Delete user (cascading deletes will handle related data)
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user account' });
  }
});

// ==================== CONTENT MODERATION ====================

// Get flagged/reported content (Admin & Moderator)
router.get('/reported-content', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { type, status = 'pending', limit = 50 } = req.query;

    // Create reports table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id INT PRIMARY KEY AUTO_INCREMENT,
        content_type ENUM('recipe', 'comment', 'user') NOT NULL,
        content_id INT NOT NULL,
        reported_by INT NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        reviewed_by INT NULL,
        FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    let query = `
      SELECT cr.*, 
        u1.username as reporter_username,
        u2.username as reviewer_username
      FROM content_reports cr
      LEFT JOIN users u1 ON cr.reported_by = u1.id
      LEFT JOIN users u2 ON cr.reviewed_by = u2.id
      WHERE cr.status = ?
    `;
    const params = [status];

    if (type) {
      query += ' AND cr.content_type = ?';
      params.push(type);
    }

    const limitVal = Math.max(1, Math.min(500, parseInt(limit) || 50));
    query += ' ORDER BY cr.created_at DESC LIMIT ?';
    params.push(limitVal);

    const [reports] = await pool.query(query, params);

    res.json(reports);
  } catch (error) {
    console.error('Error fetching reported content:', error);
    res.status(500).json({ error: 'Failed to fetch reported content' });
  }
});

// Report content (Any authenticated user)
router.post('/report', authenticateToken, async (req, res) => {
  try {
    const { contentType, contentId, reason } = req.body;

    if (!['recipe', 'comment', 'user'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    if (!contentId || !reason) {
      return res.status(400).json({ error: 'Content ID and reason are required' });
    }

    // Create reports table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id INT PRIMARY KEY AUTO_INCREMENT,
        content_type ENUM('recipe', 'comment', 'user') NOT NULL,
        content_id INT NOT NULL,
        reported_by INT NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        reviewed_by INT NULL,
        FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await pool.execute(`
      INSERT INTO content_reports (content_type, content_id, reported_by, reason)
      VALUES (?, ?, ?, ?)
    `, [contentType, contentId, req.user.id, reason]);

    res.json({ message: 'Content reported successfully' });
  } catch (error) {
    console.error('Error reporting content:', error);
    res.status(500).json({ error: 'Failed to report content' });
  }
});

// Update report status (Admin & Moderator)
router.patch('/reports/:reportId', authenticateToken, requireModerator, async (req, res) => {
  try {
    const reportId = validateId(req.params.reportId);
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.execute(`
      UPDATE content_reports 
      SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
      WHERE id = ?
    `, [status, req.user.id, reportId]);

    res.json({ message: 'Report status updated successfully' });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

// Get all recipes for moderation (Admin & Moderator)
router.get('/recipes', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { search, sortBy = 'created_at', order = 'DESC', limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT r.id, r.title, r.description, r.created_at, r.created_by,
        u.username as author_username,
        (SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.id) as likes,
        (SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.id) as comments,
        (SELECT COUNT(*) FROM recipe_ratings WHERE recipe_id = r.id) as ratings
      FROM recipes r
      JOIN users u ON r.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (r.title LIKE ? OR r.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const validSortColumns = ['created_at', 'title'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const limitVal = Math.max(1, Math.min(500, parseInt(limit) || 50));
    const offsetVal = Math.max(0, parseInt(offset) || 0);

    query += ` ORDER BY r.${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limitVal, offsetVal);

    const [recipes] = await pool.query(query, params);

    res.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes for moderation:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Get all comments for moderation (Admin & Moderator)
router.get('/comments', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT c.id, c.comment_text as content, c.created_at, c.user_id, c.recipe_id,
        u.username as author_username,
        r.title as recipe_title
      FROM recipe_comments c
      JOIN users u ON c.user_id = u.id
      JOIN recipes r ON c.recipe_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND c.content LIKE ?';
      params.push(`%${search}%`);
    }

    const limitVal = Math.max(1, Math.min(500, parseInt(limit) || 50));
    const offsetVal = Math.max(0, parseInt(offset) || 0);
    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitVal, offsetVal);

    const [comments] = await pool.query(query, params);

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments for moderation:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Delete recipe (Admin & Moderator)
router.delete('/recipes/:recipeId', authenticateToken, requireModerator, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const { reason } = req.body;

    // Check if recipe exists
    const [recipes] = await pool.execute('SELECT created_by FROM recipes WHERE id = ?', [recipeId]);
    
    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Log the deletion
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS moderation_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        moderator_id INT NOT NULL,
        action ENUM('delete_recipe', 'delete_comment', 'ban_user', 'suspend_user') NOT NULL,
        target_id INT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await pool.execute(`
      INSERT INTO moderation_log (moderator_id, action, target_id, reason)
      VALUES (?, 'delete_recipe', ?, ?)
    `, [req.user.id, recipeId, reason || 'No reason provided']);

    // Delete recipe
    await pool.execute('DELETE FROM recipes WHERE id = ?', [recipeId]);

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Delete comment (Admin & Moderator)
router.delete('/comments/:commentId', authenticateToken, requireModerator, async (req, res) => {
  try {
    const commentId = validateId(req.params.commentId);
    const { reason } = req.body;

    // Check if comment exists
    const [comments] = await pool.execute('SELECT user_id FROM recipe_comments WHERE id = ?', [commentId]);
    
    if (comments.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Log the deletion
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS moderation_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        moderator_id INT NOT NULL,
        action ENUM('delete_recipe', 'delete_comment', 'ban_user', 'suspend_user') NOT NULL,
        target_id INT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await pool.execute(`
      INSERT INTO moderation_log (moderator_id, action, target_id, reason)
      VALUES (?, 'delete_comment', ?, ?)
    `, [req.user.id, commentId, reason || 'No reason provided']);

    // Delete comment
    await pool.execute('DELETE FROM recipe_comments WHERE id = ?', [commentId]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Get moderation log (Admin only)
router.get('/moderation-log', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    // Create table if not exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS moderation_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        moderator_id INT NOT NULL,
        action ENUM('delete_recipe', 'delete_comment', 'ban_user', 'suspend_user') NOT NULL,
        target_id INT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    const [logs] = await pool.execute(`
      SELECT ml.*, u.username as moderator_username
      FROM moderation_log ml
      JOIN users u ON ml.moderator_id = u.id
      ORDER BY ml.created_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching moderation log:', error);
    res.status(500).json({ error: 'Failed to fetch moderation log' });
  }
});

export default router;
