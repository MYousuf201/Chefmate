import { pool } from '../config/database.js';

function parseJsonArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); }
  catch { return []; }
}

const WEIGHTS = {
  CUISINE: 0.35,
  INGREDIENT: 0.30,
  DIFFICULTY: 0.10,
  TIME: 0.15,
  CREATOR: 0.10,
};

const PENALTY_ALREADY_INTERACTED = 0.3;

function normalizeIngredient(str) {
  return str.toLowerCase().replace(/^\d+\s*/, '').replace(/[^a-z\s]/g, '').trim();
}

function ingredientOverlap(profileTokens, recipeIngredients) {
  if (!profileTokens || profileTokens.size === 0 || !recipeIngredients || recipeIngredients.length === 0) return 0;
  const recipeTokens = new Set(recipeIngredients.map(normalizeIngredient).filter(Boolean));
  if (recipeTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of recipeTokens) {
    if (profileTokens.has(token)) intersection++;
  }
  return intersection / Math.max(recipeTokens.size, profileTokens.size);
}

function timeSimilarity(avgTime, recipePrep, recipeCook) {
  const recipeTime = (recipePrep || 0) + (recipeCook || 0);
  if (avgTime === 0) return 0;
  const diff = Math.abs(avgTime - recipeTime);
  return Math.max(0, 1 - diff / Math.max(avgTime, recipeTime));
}

function scoreRecipe(recipe, profile) {
  let score = 0;
  const breakdown = { cuisine: 0, ingredients: 0, difficulty: 0, time: 0, creator: 0 };

  if (profile.preferredCuisines.has(recipe.cuisine)) {
    score += WEIGHTS.CUISINE;
    breakdown.cuisine = WEIGHTS.CUISINE;
  }

  const ingScore = ingredientOverlap(profile.ingredientTokens, recipe.ingredients);
  score += ingScore * WEIGHTS.INGREDIENT;
  breakdown.ingredients = ingScore * WEIGHTS.INGREDIENT;

  if (profile.preferredDifficulties.has(recipe.difficulty)) {
    score += WEIGHTS.DIFFICULTY;
    breakdown.difficulty = WEIGHTS.DIFFICULTY;
  }

  const timeScore = timeSimilarity(profile.avgTotalTime, recipe.prep_time, recipe.cook_time);
  score += timeScore * WEIGHTS.TIME;
  breakdown.time = timeScore * WEIGHTS.TIME;

  if (profile.favoriteCreatorIds.has(recipe.created_by)) {
    score += WEIGHTS.CREATOR;
    breakdown.creator = WEIGHTS.CREATOR;
  }

  if (profile.interactedRecipeIds.has(recipe.id)) {
    score *= PENALTY_ALREADY_INTERACTED;
  }

  return { score, breakdown };
}

export async function buildUserProfile(userId) {
  const profile = {
    preferredCuisines: new Set(),
    preferredDifficulties: new Set(),
    ingredientTokens: new Map(),
    avgTotalTime: 0,
    favoriteCreatorIds: new Set(),
    interactedRecipeIds: new Set(),
    totalSignals: 0,
  };

  const [likedRecipes] = await pool.execute(`
    SELECT r.id, r.cuisine, r.difficulty, r.ingredients, r.prep_time, r.cook_time, r.created_by
    FROM recipe_likes rl
    JOIN recipes r ON rl.recipe_id = r.id
    WHERE rl.user_id = ? AND rl.like_type = 'like'
  `, [userId]);

  const [highRatedRecipes] = await pool.execute(`
    SELECT r.id, r.cuisine, r.difficulty, r.ingredients, r.prep_time, r.cook_time, r.created_by
    FROM recipe_ratings rr
    JOIN recipes r ON rr.recipe_id = r.id
    WHERE rr.user_id = ? AND rr.rating >= 4
  `, [userId]);

  const allSignals = [...likedRecipes, ...highRatedRecipes];
  if (allSignals.length === 0) return null;

  let totalTime = 0;
  const ingredientFrequencies = {};

  for (const recipe of allSignals) {
    profile.interactedRecipeIds.add(recipe.id);
    profile.favoriteCreatorIds.add(recipe.created_by);

    if (recipe.cuisine) profile.preferredCuisines.add(recipe.cuisine);
    if (recipe.difficulty) profile.preferredDifficulties.add(recipe.difficulty);

    totalTime += (recipe.prep_time || 0) + (recipe.cook_time || 0);

    if (recipe.ingredients) {
      let ingredients = [];
      try {
        ingredients = parseJsonArray(recipe.ingredients);
      } catch { ingredients = []; }

      for (const ing of ingredients) {
        const normalized = normalizeIngredient(ing);
        if (normalized) {
          ingredientFrequencies[normalized] = (ingredientFrequencies[normalized] || 0) + 1;
        }
      }
    }
  }

  profile.totalSignals = allSignals.length;
  profile.avgTotalTime = totalTime / allSignals.length;

  for (const [token, freq] of Object.entries(ingredientFrequencies)) {
    if (freq >= 2) {
      profile.ingredientTokens.set(token, freq);
    }
  }

  return profile;
}

export async function reorderRecipes(recipes, userId) {
  if (!userId || recipes.length <= 1) return recipes;

  const profile = await buildUserProfile(userId);
  if (!profile) return recipes;

  const scored = recipes.map(recipe => {
    const { score, breakdown } = scoreRecipe(recipe, profile);
    return { ...recipe, relevanceScore: parseFloat(score.toFixed(4)), scoreBreakdown: breakdown };
  });

  scored.sort((a, b) => {
    const diff = b.relevanceScore - a.relevanceScore;
    if (diff !== 0) return diff;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  return scored;
}
