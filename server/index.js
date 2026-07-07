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

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://chef-mate.app', 'https://www.chef-mate.app']
    : function (origin, callback) {
        if (!origin) return callback(null, true);
        const allowed = [
          'http://localhost:5173',
          'http://localhost:4173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:4173',
        ];
        if (allowed.includes(origin)) return callback(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
  max: 100,
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
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: err.errorMessage || 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await testConnection();
    await initializeDatabase();
    
    app.listen(port, () => {
      console.log(`🍳 Chef-Mate API server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();