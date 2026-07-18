import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { createNotification } from './notifications.js';
import { validateId } from '../config/validation.js';
import { reorderRecipes } from '../services/recommendation.js';
import { identifyIngredients } from '../services/vision.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream') {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const isVercel = process.env.VERCEL === '1';
let uploadImage, upload;

if (isVercel) {
  uploadImage = multer({ storage: multer.memoryStorage(), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
  upload = multer({ storage: multer.memoryStorage(), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
} else {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const imageStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const name = crypto.randomBytes(16).toString('hex') + ext;
      cb(null, name);
    }
  });
  uploadImage = multer({ storage: imageStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
  upload = multer({ storage: multer.memoryStorage(), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
}

function parseJsonArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); }
  catch { return []; }
}

const router = express.Router();

// Get all recipes with optional search/filter/pagination
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      search = '',
      cuisine = '',
      difficulty = '',
      page = '1',
      limit = '15'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    const countParams = [];
    if (req.user) {
      params.push(req.user.id, req.user.id);
    }

    let query = `
      SELECT r.*,
        u.name as creator_name, u.username as creator_username, u.id as creator_id,
        CAST(COALESCE(lk.likes, 0) AS UNSIGNED) as like_count,
        CAST(COALESCE(lk.dislikes, 0) AS UNSIGNED) as dislike_count,
        CAST(COALESCE(fv.fav_count, 0) AS UNSIGNED) as favorite_count,
        CAST(COALESCE(cm.comment_count, 0) AS UNSIGNED) as comment_count,
        rt.avg_rating as average_rating,
        CAST(COALESCE(rt.rating_count, 0) AS UNSIGNED) as rating_count
        ${req.user ? `, CAST(CASE WHEN uf.id IS NOT NULL THEN 1 ELSE 0 END AS UNSIGNED) as is_favorited` : ''}
        ${req.user ? ', ul.like_type as user_like_type' : ''}
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN (
        SELECT recipe_id,
          SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
        FROM recipe_likes GROUP BY recipe_id
      ) lk ON lk.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as fav_count
        FROM user_favorites GROUP BY recipe_id
      ) fv ON fv.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as comment_count
        FROM recipe_comments GROUP BY recipe_id
      ) cm ON cm.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
        FROM recipe_ratings GROUP BY recipe_id
      ) rt ON rt.recipe_id = r.id
      ${req.user ? 'LEFT JOIN user_favorites uf ON uf.recipe_id = r.id AND uf.user_id = ?' : ''}
      ${req.user ? 'LEFT JOIN recipe_likes ul ON ul.recipe_id = r.id AND ul.user_id = ?' : ''}
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
    `;

    if (search) {
      const likeTerm = `%${search}%`;
      conditions.push(`(r.title LIKE ? OR r.description LIKE ? OR r.cuisine LIKE ? OR JSON_SEARCH(r.ingredients, 'one', ?) IS NOT NULL)`);
      params.push(likeTerm, likeTerm, likeTerm, likeTerm);
      countParams.push(likeTerm, likeTerm, likeTerm, likeTerm);
    }

    if (cuisine) {
      conditions.push(`r.cuisine = ?`);
      params.push(cuisine);
      countParams.push(cuisine);
    }

    if (difficulty) {
      conditions.push(`r.difficulty = ?`);
      params.push(difficulty);
      countParams.push(difficulty);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY r.created_at DESC';
    query += ` LIMIT ${Number(limitNum)} OFFSET ${Number(offset)}`;

    const [[{ total }]] = await pool.query(countQuery, countParams);
    const [recipes] = await pool.query(query, params);

    const parsedRecipes = recipes.map(recipe => {
      let ingredients = [];
      let instructions = [];

      try {
        ingredients = parseJsonArray(recipe.ingredients);
      } catch {
        ingredients = [];
      }

      try {
        instructions = parseJsonArray(recipe.instructions);
      } catch {
        instructions = [];
      }

      return {
        ...recipe,
        ingredients,
        instructions
      };
    });

    let resultRecipes = parsedRecipes;
    if (req.user) {
      resultRecipes = await reorderRecipes(parsedRecipes, req.user.id);
    }

    res.json({
      recipes: resultRecipes,
      totalCount: total,
      page: pageNum,
      limit: limitNum,
      hasMore: pageNum * limitNum < total
    });

  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({
      error: 'Failed to fetch recipes'
    });
  }
});

// Get specific recipe by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const [recipes] = await pool.execute(`
      SELECT r.*,
        u.name as creator_name, u.username as creator_username, u.id as creator_id,
        CAST(COALESCE(lk.likes, 0) AS UNSIGNED) as like_count,
        CAST(COALESCE(lk.dislikes, 0) AS UNSIGNED) as dislike_count,
        CAST(COALESCE(fv.fav_count, 0) AS UNSIGNED) as favorite_count,
        CAST(COALESCE(cm.comment_count, 0) AS UNSIGNED) as comment_count,
        rt.avg_rating as average_rating,
        CAST(COALESCE(rt.rating_count, 0) AS UNSIGNED) as rating_count
        ${req.user ? `, CAST(CASE WHEN uf.id IS NOT NULL THEN 1 ELSE 0 END AS UNSIGNED) as is_favorited` : ''}
        ${req.user ? ', ul.like_type as user_like_type' : ''}
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN (
        SELECT recipe_id,
          SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
        FROM recipe_likes GROUP BY recipe_id
      ) lk ON lk.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as fav_count
        FROM user_favorites GROUP BY recipe_id
      ) fv ON fv.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as comment_count
        FROM recipe_comments GROUP BY recipe_id
      ) cm ON cm.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
        FROM recipe_ratings GROUP BY recipe_id
      ) rt ON rt.recipe_id = r.id
      ${req.user ? 'LEFT JOIN user_favorites uf ON uf.recipe_id = r.id AND uf.user_id = ?' : ''}
      ${req.user ? 'LEFT JOIN recipe_likes ul ON ul.recipe_id = r.id AND ul.user_id = ?' : ''}
      WHERE r.id = ?
    `, req.user ? [req.user.id, req.user.id, id] : [id]);

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipe = recipes[0];
    try {
      recipe.ingredients = parseJsonArray(recipe.ingredients);
    } catch {
      recipe.ingredients = [];
    }
    try {
      recipe.instructions = parseJsonArray(recipe.instructions);
    } catch {
      recipe.instructions = [];
    }

    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// Get recipes created by a specific user
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const userId = validateId(req.params.userId);

    const [recipes] = await pool.execute(`
      SELECT r.*,
        u.name as creator_name, u.username as creator_username, u.id as creator_id,
        CAST(COALESCE(lk.likes, 0) AS UNSIGNED) as like_count,
        CAST(COALESCE(lk.dislikes, 0) AS UNSIGNED) as dislike_count,
        CAST(COALESCE(fv.fav_count, 0) AS UNSIGNED) as favorite_count,
        CAST(COALESCE(cm.comment_count, 0) AS UNSIGNED) as comment_count,
        rt.avg_rating as average_rating,
        CAST(COALESCE(rt.rating_count, 0) AS UNSIGNED) as rating_count
        ${req.user ? `, CAST(CASE WHEN uf.id IS NOT NULL THEN 1 ELSE 0 END AS UNSIGNED) as is_favorited` : ''}
        ${req.user ? ', ul.like_type as user_like_type' : ''}
      FROM recipes r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN (
        SELECT recipe_id,
          SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
        FROM recipe_likes GROUP BY recipe_id
      ) lk ON lk.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as fav_count
        FROM user_favorites GROUP BY recipe_id
      ) fv ON fv.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as comment_count
        FROM recipe_comments GROUP BY recipe_id
      ) cm ON cm.recipe_id = r.id
      LEFT JOIN (
        SELECT recipe_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
        FROM recipe_ratings GROUP BY recipe_id
      ) rt ON rt.recipe_id = r.id
      ${req.user ? 'LEFT JOIN user_favorites uf ON uf.recipe_id = r.id AND uf.user_id = ?' : ''}
      ${req.user ? 'LEFT JOIN recipe_likes ul ON ul.recipe_id = r.id AND ul.user_id = ?' : ''}
      WHERE r.created_by = ?
      ORDER BY r.created_at DESC
    `, req.user ? [req.user.id, req.user.id, userId] : [userId]);

    const parsed = recipes.map(recipe => {
      try {
        return {
          ...recipe,
          ingredients: parseJsonArray(recipe.ingredients),
          instructions: parseJsonArray(recipe.instructions)
        };
      } catch {
        return { ...recipe, ingredients: [], instructions: [] };
      }
    });

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching user recipes:', error);
    res.status(500).json({ error: 'Failed to fetch user recipes' });
  }
});

// Get user's favorite recipes
router.get('/favorites/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = validateId(req.params.userId);

    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [favorites] = await pool.execute(`
      SELECT r.*, u.name as creator_name, u.username as creator_username,
        true as is_favorited
      FROM user_favorites uf
      JOIN recipes r ON uf.recipe_id = r.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
    `, [userId]);

    const parsedFavorites = favorites.map(recipe => {
      let ingredients = [];
      let instructions = [];
      try {
        ingredients = parseJsonArray(recipe.ingredients);
      } catch {}
      try {
        instructions = parseJsonArray(recipe.instructions);
      } catch {}
      return { ...recipe, ingredients, instructions };
    });

    res.json(parsedFavorites);
  } catch (error) {
    console.error('Error fetching user favorites:', error);
    res.status(500).json({ error: 'Failed to fetch user favorites' });
  }
});

// POST /recipes/scan-ingredients — upload image, AI identifies ingredients
router.post('/scan-ingredients', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const base64 = req.file.buffer.toString('base64');
    const ingredients = await identifyIngredients(base64);

    res.json({ ingredients });
  } catch (error) {
    console.error('Error scanning ingredients:', error);
    res.status(500).json({ error: 'Failed to scan ingredients' });
  }
});

// POST /recipes/upload-image — upload a recipe image, returns the URL
router.post('/upload-image', authenticateToken, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }
    if (isVercel) {
      return res.status(503).json({ error: 'Image upload not available on serverless tier. Use a direct image URL instead.' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ image_url: imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

function wordBagMatch(a, b) {
  const wordsA = a.split(/\s+/).filter(s => s.length > 1);
  const wordsB = b.split(/\s+/).filter(s => s.length > 1);
  return wordsA.some(w => wordsB.includes(w));
}

function minWordMatchRatio(inputWords, recipeWords) {
  if (inputWords.length === 0 || recipeWords.length === 0) return 0;
  const matched = inputWords.filter(inp =>
    recipeWords.some(ri => wordBagMatch(inp, ri))
  );
  return matched.length / inputWords.length;
}

function cleanIngredientName(raw) {
  return raw
    .replace(/^\d+([\s.\/]*\d+)*\s*/, '')
    .replace(/^(tbsp|tbs|tsp|tspn|g|ml|kg|l|oz|lb|cup|cups|pinch|dash|cloves?|slices?|pieces?|cans?|packages?|bunch|handful|sprigs?|leaves?|sticks?)\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/,.*$/, '')
    .trim();
}

// POST /recipes/by-ingredients — search recipes by ingredient list
router.post('/by-ingredients', authenticateToken, async (req, res) => {
  try {
    const { ingredients } = req.body;
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Provide an array of ingredients' });
    }

    const normalizedInput = ingredients.map(i =>
      i.toLowerCase().replace(/^\d+\s*/, '').replace(/[^a-z\s]/g, '').trim()
    ).filter(Boolean);

    const [recipes] = await pool.execute('SELECT * FROM recipes ORDER BY created_at DESC');
    const scored = [];

    for (const recipe of recipes) {
      let recipeIngredients = [];
      try {
        recipeIngredients = parseJsonArray(recipe.ingredients);
      } catch { recipeIngredients = []; }

      const normalizedRecipe = recipeIngredients.map(i => {
        let cleaned = i.toLowerCase();
        cleaned = cleaned.replace(/^\d+([\s.\/]*\d+)*\s*/, '');
        cleaned = cleaned.replace(/^(tbsp|tbs|tsp|tspn|g|ml|kg|l|oz|lb|cup|cups|pinch|dash|cloves?|slices?|pieces?|cans?|packages?|bunch|handful|sprigs?|leaves?|sticks?)\s+/i, '');
        cleaned = cleaned.replace(/\s*\(.*?\)\s*/g, '');
        cleaned = cleaned.replace(/,.*$/, '');
        cleaned = cleaned.replace(/[^a-z\s]/g, '').trim();
        return cleaned;
      }).filter(Boolean);

      const matched = normalizedInput.filter(inp =>
        normalizedRecipe.some(ri => wordBagMatch(inp, ri))
      );
      const matchScore = normalizedInput.length > 0
        ? matched.length / normalizedInput.length
        : 0;

      const missing = normalizedRecipe.filter(ri =>
        !normalizedInput.some(inp => wordBagMatch(inp, ri))
      );

      if (matched.length > 0) {
        let parsed = { ...recipe };
        try {
          parsed.ingredients = parseJsonArray(recipe.ingredients);
          parsed.instructions = parseJsonArray(recipe.instructions);
        } catch { parsed.ingredients = []; parsed.instructions = []; }

        scored.push({
          ...parsed,
          matchScore: parseFloat(matchScore.toFixed(2)),
          missingIngredients: missing,
          totalMissing: missing.length
        });
      }
    }

    scored.sort((a, b) => b.matchScore - a.matchScore || new Date(b.created_at) - new Date(a.created_at));

    res.json({ recipes: scored, totalCount: scored.length });
  } catch (error) {
    console.error('Error searching by ingredients:', error);
    res.status(500).json({ error: 'Failed to search by ingredients' });
  }
});

// Create a new recipe
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      ingredients,
      instructions,
      cuisine,
      prep_time,
      cook_time,
      servings,
      difficulty,
      image_url
    } = req.body;

    if (!title || !ingredients || !instructions) {
      return res.status(400).json({
        error: 'Title, ingredients, and instructions are required'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO recipes (
        title, description, ingredients, instructions, cuisine,
        prep_time, cook_time, servings, difficulty, image_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description || '',
      JSON.stringify(ingredients),
      JSON.stringify(instructions),
      cuisine || '',
      prep_time || 0,
      cook_time || 0,
      servings || 1,
      difficulty || 'easy',
      image_url || '',
      req.user.id
    ]);

    const [recipes] = await pool.execute(
      'SELECT * FROM recipes WHERE id = ?',
      [result.insertId]
    );

    const recipe = recipes[0];
    try {
      recipe.ingredients = parseJsonArray(recipe.ingredients);
    } catch {
      recipe.ingredients = [];
    }
    try {
      recipe.instructions = parseJsonArray(recipe.instructions);
    } catch {
      recipe.instructions = [];
    }

    // Notify followers about new recipe
    try {
      const [followers] = await pool.execute(
        'SELECT follower_id FROM user_follows WHERE following_id = ?',
        [req.user.id]
      );
      
      for (const follower of followers) {
        await createNotification(
          follower.follower_id,
          'new_recipe_from_followed',
          req.user.id,
          result.insertId
        );
      }
    } catch (notifError) {
      console.error('Error creating notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json(recipe);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// Update a recipe
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const {
      title,
      description,
      ingredients,
      instructions,
      cuisine,
      prep_time,
      cook_time,
      servings,
      difficulty,
      image_url
    } = req.body;

    const [existingRecipes] = await pool.execute(
      'SELECT created_by FROM recipes WHERE id = ?',
      [id]
    );

    if (existingRecipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    if (existingRecipes[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute(`
      UPDATE recipes SET
        title = ?, description = ?, ingredients = ?, instructions = ?,
        cuisine = ?, prep_time = ?, cook_time = ?, servings = ?,
        difficulty = ?, image_url = ?
      WHERE id = ?
    `, [
      title,
      description || '',
      JSON.stringify(ingredients),
      JSON.stringify(instructions),
      cuisine || '',
      prep_time || 0,
      cook_time || 0,
      servings || 1,
      difficulty || 'easy',
      image_url || '',
      id
    ]);

    const [recipes] = await pool.execute(
      'SELECT * FROM recipes WHERE id = ?',
      [id]
    );

    const recipe = recipes[0];
    try {
      recipe.ingredients = parseJsonArray(recipe.ingredients);
    } catch {
      recipe.ingredients = [];
    }
    try {
      recipe.instructions = parseJsonArray(recipe.instructions);
    } catch {
      recipe.instructions = [];
    }

    res.json(recipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// Delete a recipe
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = validateId(req.params.id);

    const [existingRecipes] = await pool.execute(
      'SELECT created_by FROM recipes WHERE id = ?',
      [id]
    );

    if (existingRecipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Allow owner, moderators, and admins to delete
    const isOwner = existingRecipes[0].created_by === req.user.id;
    const isModerator = req.user.role === 'moderator' || req.user.role === 'admin';

    if (!isOwner && !isModerator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute('DELETE FROM recipes WHERE id = ?', [id]);

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Add recipe to favorites
router.post('/favorites/:recipeId', authenticateToken, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const userId = req.user.id;

    const [recipes] = await pool.execute(
      'SELECT id FROM recipes WHERE id = ?',
      [recipeId]
    );

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    try {
      await pool.execute(
        'INSERT INTO user_favorites (user_id, recipe_id) VALUES (?, ?)',
        [userId, recipeId]
      );
      res.status(201).json({ message: 'Recipe added to favorites' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Recipe already in favorites' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ error: 'Failed to add to favorites' });
  }
});

// Remove recipe from favorites
router.delete('/favorites/:recipeId', authenticateToken, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const userId = req.user.id;

    await pool.execute(
      'DELETE FROM user_favorites WHERE user_id = ? AND recipe_id = ?',
      [userId, recipeId]
    );

    res.json({ message: 'Recipe removed from favorites' });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({ error: 'Failed to remove from favorites' });
  }
});

// Get recipe likes/dislikes
router.get('/:recipeId/likes', optionalAuth, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);

    // Get counts
    const [likeCounts] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
      FROM recipe_likes 
      WHERE recipe_id = ?`,
      [recipeId]
    );

    // Get user's like status if authenticated
    let userLike = null;
    if (req.user) {
      const [userLikes] = await pool.execute(
        'SELECT like_type FROM recipe_likes WHERE user_id = ? AND recipe_id = ?',
        [req.user.id, recipeId]
      );
      userLike = userLikes.length > 0 ? userLikes[0].like_type : null;
    }

    res.json({
      likes: parseInt(likeCounts[0].likes) || 0,
      dislikes: parseInt(likeCounts[0].dislikes) || 0,
      userLike
    });
  } catch (error) {
    console.error('Error fetching likes:', error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// Add or update like/dislike
router.post('/:recipeId/likes', authenticateToken, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const { likeType } = req.body; // 'like' or 'dislike'
    const userId = req.user.id;

    if (!['like', 'dislike'].includes(likeType)) {
      return res.status(400).json({ error: 'Invalid like type' });
    }

    // Check if recipe exists
    const [recipes] = await pool.execute(
      'SELECT id FROM recipes WHERE id = ?',
      [recipeId]
    );

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Insert or update like
    await pool.execute(
      `INSERT INTO recipe_likes (user_id, recipe_id, like_type) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE like_type = ?, updated_at = CURRENT_TIMESTAMP`,
      [userId, recipeId, likeType, likeType]
    );

    // Get updated counts
    const [likeCounts] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
      FROM recipe_likes 
      WHERE recipe_id = ?`,
      [recipeId]
    );

    res.json({
      message: 'Like updated successfully',
      likes: parseInt(likeCounts[0].likes) || 0,
      dislikes: parseInt(likeCounts[0].dislikes) || 0,
      userLike: likeType
    });
  } catch (error) {
    console.error('Error updating like:', error);
    res.status(500).json({ error: 'Failed to update like' });
  }
});

// Remove like/dislike
router.delete('/:recipeId/likes', authenticateToken, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const userId = req.user.id;

    await pool.execute(
      'DELETE FROM recipe_likes WHERE user_id = ? AND recipe_id = ?',
      [userId, recipeId]
    );

    // Get updated counts
    const [likeCounts] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
      FROM recipe_likes 
      WHERE recipe_id = ?`,
      [recipeId]
    );

    res.json({
      message: 'Like removed successfully',
      likes: parseInt(likeCounts[0].likes) || 0,
      dislikes: parseInt(likeCounts[0].dislikes) || 0,
      userLike: null
    });
  } catch (error) {
    console.error('Error removing like:', error);
    res.status(500).json({ error: 'Failed to remove like' });
  }
});

// Get recipe ratings
router.get('/:recipeId/ratings', optionalAuth, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);

    // Get average rating and count
    const [stats] = await pool.execute(
      `SELECT 
        AVG(rating) as averageRating,
        COUNT(*) as totalRatings,
        SUM(CASE WHEN tried_it = TRUE THEN 1 ELSE 0 END) as triedCount
      FROM recipe_ratings 
      WHERE recipe_id = ?`,
      [recipeId]
    );

    // Get user's rating if authenticated
    let userRating = null;
    if (req.user) {
      const [userRatings] = await pool.execute(
        'SELECT rating, tried_it, review_comment FROM recipe_ratings WHERE user_id = ? AND recipe_id = ?',
        [req.user.id, recipeId]
      );
      if (userRatings.length > 0) {
        userRating = {
          rating: userRatings[0].rating,
          triedIt: userRatings[0].tried_it === 1,
          reviewComment: userRatings[0].review_comment
        };
      }
    }

    res.json({
      averageRating: parseFloat(stats[0].averageRating) || 0,
      totalRatings: parseInt(stats[0].totalRatings) || 0,
      triedCount: parseInt(stats[0].triedCount) || 0,
      userRating
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Add or update rating
router.post('/:recipeId/ratings', authenticateToken, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const { rating, triedIt, reviewComment } = req.body;
    const userId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if recipe exists
    const [recipes] = await pool.execute(
      'SELECT id FROM recipes WHERE id = ?',
      [recipeId]
    );

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Insert or update rating
    await pool.execute(
      `INSERT INTO recipe_ratings (user_id, recipe_id, rating, tried_it, review_comment) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
         rating = ?, 
         tried_it = ?, 
         review_comment = ?,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, recipeId, rating, triedIt || false, reviewComment || null, rating, triedIt || false, reviewComment || null]
    );

    // Get updated stats
    const [stats] = await pool.execute(
      `SELECT 
        AVG(rating) as averageRating,
        COUNT(*) as totalRatings,
        SUM(CASE WHEN tried_it = TRUE THEN 1 ELSE 0 END) as triedCount
      FROM recipe_ratings 
      WHERE recipe_id = ?`,
      [recipeId]
    );

    res.json({
      message: 'Rating submitted successfully',
      averageRating: parseFloat(stats[0].averageRating) || 0,
      totalRatings: parseInt(stats[0].totalRatings) || 0,
      triedCount: parseInt(stats[0].triedCount) || 0,
      userRating: {
        rating,
        triedIt: triedIt || false,
        reviewComment: reviewComment || null
      }
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Delete rating
router.delete('/:recipeId/ratings', authenticateToken, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const userId = req.user.id;

    await pool.execute(
      'DELETE FROM recipe_ratings WHERE user_id = ? AND recipe_id = ?',
      [userId, recipeId]
    );

    // Get updated stats
    const [stats] = await pool.execute(
      `SELECT 
        AVG(rating) as averageRating,
        COUNT(*) as totalRatings,
        SUM(CASE WHEN tried_it = TRUE THEN 1 ELSE 0 END) as triedCount
      FROM recipe_ratings 
      WHERE recipe_id = ?`,
      [recipeId]
    );

    res.json({
      message: 'Rating removed successfully',
      averageRating: parseFloat(stats[0].averageRating) || 0,
      totalRatings: parseInt(stats[0].totalRatings) || 0,
      triedCount: parseInt(stats[0].triedCount) || 0,
      userRating: null
    });
  } catch (error) {
    console.error('Error removing rating:', error);
    res.status(500).json({ error: 'Failed to remove rating' });
  }
});

// Get comments for a recipe
router.get('/:recipeId/comments', optionalAuth, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);

    const [comments] = await pool.execute(
      `SELECT 
        c.id, c.recipe_id, c.user_id, c.parent_comment_id, c.comment_text, c.created_at,
        u.name as user_name, u.email as user_email, u.username as user_username,
        SUM(CASE WHEN cl.like_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN cl.like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
      FROM recipe_comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.recipe_id = ?
      GROUP BY c.id, c.recipe_id, c.user_id, c.parent_comment_id, c.comment_text, c.created_at, u.name, u.email, u.username
      ORDER BY c.created_at ASC`,
      [recipeId]
    );

    // Get user's likes if authenticated
    let userLikes = {};
    if (req.user && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const placeholders = commentIds.map(() => '?').join(',');
      const [likes] = await pool.execute(
        `SELECT comment_id, like_type FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`,
        [req.user.id, ...commentIds]
      );
      userLikes = likes.reduce((acc, like) => {
        acc[like.comment_id] = like.like_type;
        return acc;
      }, {});
    }

    const commentsWithLikes = comments.map(comment => ({
      ...comment,
      likes: parseInt(comment.likes) || 0,
      dislikes: parseInt(comment.dislikes) || 0,
      userLike: userLikes[comment.id] || null
    }));

    res.json({ comments: commentsWithLikes });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add a comment
router.post('/:recipeId/comments', authenticateToken, async (req, res) => {
  try {
    const recipeId = validateId(req.params.recipeId);
    const { commentText, parentCommentId } = req.body;
    const userId = req.user.id;

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (commentText.length > 750) {
      return res.status(400).json({ error: 'Comment must be 150 words or less' });
    }

    // Check if recipe exists
    const [recipes] = await pool.execute(
      'SELECT id FROM recipes WHERE id = ?',
      [recipeId]
    );

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // If replying, check if parent comment exists
    if (parentCommentId) {
      const [parentComments] = await pool.execute(
        'SELECT id FROM recipe_comments WHERE id = ? AND recipe_id = ?',
        [parentCommentId, recipeId]
      );

      if (parentComments.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    const [result] = await pool.execute(
      'INSERT INTO recipe_comments (recipe_id, user_id, parent_comment_id, comment_text) VALUES (?, ?, ?, ?)',
      [recipeId, userId, parentCommentId || null, commentText.trim()]
    );

    const [newComment] = await pool.execute(
      `SELECT 
        c.id, c.recipe_id, c.user_id, c.parent_comment_id, c.comment_text, c.created_at,
        u.name as user_name, u.email as user_email, u.username as user_username
      FROM recipe_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?`,
      [result.insertId]
    );

    // Create notifications
    try {
      if (parentCommentId) {
        // Reply to comment - notify the parent comment author
        const [parentComment] = await pool.execute(
          'SELECT user_id FROM recipe_comments WHERE id = ?',
          [parentCommentId]
        );
        
        if (parentComment.length > 0) {
          await createNotification(
            parentComment[0].user_id,
            'reply_to_comment',
            userId,
            recipeId,
            result.insertId
          );
        }
      } else {
        // New comment on recipe - notify recipe owner
        const [recipe] = await pool.execute(
          'SELECT created_by FROM recipes WHERE id = ?',
          [recipeId]
        );
        
        if (recipe.length > 0) {
          await createNotification(
            recipe[0].created_by,
            'comment_on_recipe',
            userId,
            recipeId,
            result.insertId
          );
        }
      }
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: {
        ...newComment[0],
        likes: 0,
        dislikes: 0,
        userLike: null
      }
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Like/dislike a comment
router.post('/comments/:commentId/likes', authenticateToken, async (req, res) => {
  try {
    const commentId = validateId(req.params.commentId);
    const { likeType } = req.body;
    const userId = req.user.id;

    if (!['like', 'dislike'].includes(likeType)) {
      return res.status(400).json({ error: 'Invalid like type' });
    }

    // Insert or update like
    await pool.execute(
      `INSERT INTO comment_likes (user_id, comment_id, like_type) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE like_type = ?, updated_at = CURRENT_TIMESTAMP`,
      [userId, commentId, likeType, likeType]
    );

    // Get updated counts
    const [likeCounts] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
      FROM comment_likes 
      WHERE comment_id = ?`,
      [commentId]
    );

    res.json({
      likes: parseInt(likeCounts[0].likes) || 0,
      dislikes: parseInt(likeCounts[0].dislikes) || 0,
      userLike: likeType
    });
  } catch (error) {
    console.error('Error updating comment like:', error);
    res.status(500).json({ error: 'Failed to update like' });
  }
});

// Remove like/dislike from comment
router.delete('/comments/:commentId/likes', authenticateToken, async (req, res) => {
  try {
    const commentId = validateId(req.params.commentId);
    const userId = req.user.id;

    await pool.execute(
      'DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?',
      [userId, commentId]
    );

    // Get updated counts
    const [likeCounts] = await pool.execute(
      `SELECT 
        SUM(CASE WHEN like_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN like_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
      FROM comment_likes 
      WHERE comment_id = ?`,
      [commentId]
    );

    res.json({
      likes: parseInt(likeCounts[0].likes) || 0,
      dislikes: parseInt(likeCounts[0].dislikes) || 0,
      userLike: null
    });
  } catch (error) {
    console.error('Error removing comment like:', error);
    res.status(500).json({ error: 'Failed to remove like' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const commentId = validateId(req.params.commentId);
    const userId = req.user.id;

    // Check if comment exists
    const [comments] = await pool.execute(
      'SELECT id, user_id FROM recipe_comments WHERE id = ?',
      [commentId]
    );

    if (comments.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Allow owner, moderators, and admins to delete
    const isOwner = comments[0].user_id === userId;
    const isModerator = req.user.role === 'moderator' || req.user.role === 'admin';

    if (!isOwner && !isModerator) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Delete comment (cascade will delete replies and likes)
    await pool.execute(
      'DELETE FROM recipe_comments WHERE id = ?',
      [commentId]
    );

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
