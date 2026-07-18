import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { pool, testConnection, initializeDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import recipeRoutes from './routes/recipes.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || '*'
    : function (origin, callback) {
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/downloads', express.static(path.join(__dirname, '..', 'downloads')));
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const genericLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Chef-Mate API is running' });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/recipes', genericLimiter, recipeRoutes);
app.use('/api/users', genericLimiter, userRoutes);
app.use('/api/notifications', genericLimiter, notificationRoutes);
app.use('/api/admin', genericLimiter, adminRoutes);

// Get recipe statistics
app.get('/api/stats', async (req, res) => {
  try {
    const { pool } = await import('./config/database.js');
    
    // Get total recipes count
    const [totalResult] = await pool.execute('SELECT COUNT(*) as total FROM recipes');
    const totalRecipes = totalResult[0].total;

    // Get recipes by cuisine
    const [cuisineResult] = await pool.execute(`
      SELECT cuisine, COUNT(*) as count 
      FROM recipes 
      WHERE cuisine IS NOT NULL AND cuisine != '' 
      GROUP BY cuisine
    `);

    const cuisineStats = {};
    cuisineResult.forEach(row => {
      cuisineStats[row.cuisine] = row.count;
    });

    // Get recipes by difficulty
    const [difficultyResult] = await pool.execute(`
      SELECT difficulty, COUNT(*) as count 
      FROM recipes 
      GROUP BY difficulty
    `);

    const difficultyStats = {};
    difficultyResult.forEach(row => {
      difficultyStats[row.difficulty] = row.count;
    });

    res.json({
      totalRecipes,
      cuisineStats,
      difficultyStats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.name === 'MulterError' || err.message?.includes('Only image files')) {
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: err.errorMessage || 'Internal server error' });
});

// SPA fallback — serve index.html for all non-API client-side routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (process.env.VERCEL === '1') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// 404 handler (API routes only at this point)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function ensureDirs() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const downloadsDir = path.join(__dirname, '..', 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
}

if (process.env.VERCEL !== '1') {
  const startServer = async () => {
    try {
      await ensureDirs();
      await testConnection();
      await initializeDatabase();
      app.listen(port, () => {
        console.log(`🍳 Chef-Mate API server running on port ${port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };
  startServer();
} else {
  let dbReady = false;
  app.use('/api', (req, res, next) => {
    if (dbReady) return next();
    initializeDatabase()
      .then(() => { dbReady = true; })
      .catch(err => console.error('Vercel DB init error:', err.message))
      .finally(() => next());
  });
}

export default app;