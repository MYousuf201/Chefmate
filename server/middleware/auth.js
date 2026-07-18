import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database.js';

async function isTokenBlacklisted(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const [rows] = await pool.execute(
    'SELECT 1 FROM token_blacklist WHERE token_hash = ? AND expires_at > NOW()',
    [hash]
  );
  return rows.length > 0;
}

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const [users] = await pool.execute(
      'SELECT id, email, name, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    let userStatus;
    try {
      const [statusRows] = await pool.execute(
        'SELECT status FROM user_status WHERE user_id = ?',
        [decoded.userId]
      );
      userStatus = statusRows[0]?.status;
    } catch { /* table may not exist yet */ }

    if (userStatus === 'suspended' || userStatus === 'banned') {
      return res.status(403).json({ error: 'Account is suspended or banned' });
    }

    req.user = users[0];
    req.token = token;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

      if (await isTokenBlacklisted(token)) {
        req.tokenBlacklisted = true;
      } else {
        const [users] = await pool.execute(
          'SELECT id, email, name, role FROM users WHERE id = ?',
          [decoded.userId]
        );

        if (users.length > 0) {
          req.user = users[0];
        }
      }
    } catch (error) {
      // Token invalid, but continue without user
    }
  }

  next();
};

// Middleware to check if user is moderator or admin
export const requireModerator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'moderator' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Moderator access required' });
  }

  next();
};

// Middleware to check if user is admin
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Middleware to check if user is owner, moderator, or admin
export const requireOwnerOrModerator = (resourceUserId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isOwner = req.user.id === resourceUserId;
    const isModerator = req.user.role === 'moderator' || req.user.role === 'admin';

    if (!isOwner && !isModerator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};