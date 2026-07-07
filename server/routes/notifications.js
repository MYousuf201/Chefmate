import express from 'express';
import { pool } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateId } from '../config/validation.js';

const router = express.Router();

// Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, unread_only = false } = req.query;
    const limitValue = Math.max(1, Math.min(100, parseInt(limit) || 20));
    
    let query = `SELECT n.*, actor.username as actor_username, actor.name as actor_name, r.title as recipe_title, c.comment_text as comment_text FROM notifications n LEFT JOIN users actor ON n.actor_id = actor.id LEFT JOIN recipes r ON n.recipe_id = r.id LEFT JOIN recipe_comments c ON n.comment_id = c.id WHERE n.user_id = ?`;
    
    const params = [req.user.id];
    
    if (unread_only === 'true') {
      query += ' AND n.is_read = FALSE';
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT ?';
    params.push(parseInt(limitValue));
    
    const [notifications] = await pool.query(query, params);
    
    // Get unread count
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    
    res.json({ 
      notifications,
      unreadCount: countResult[0].count
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    
    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const id = validateId(req.params.id);
    
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Create notification helper function (exported for use in other routes)
export async function createNotification(userId, type, actorId, recipeId, commentId = null) {
  try {
    // Don't create notification if actor is the same as the recipient
    if (userId === actorId) {
      return;
    }
    
    await pool.execute(
      'INSERT INTO notifications (user_id, type, actor_id, recipe_id, comment_id) VALUES (?, ?, ?, ?, ?)',
      [userId, type, actorId, recipeId, commentId]
    );
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export default router;
