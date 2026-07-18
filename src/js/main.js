// Global state
let currentUser = null;
let currentPage = 'home';
let recipes = [];
let userFavorites = [];
let authToken = localStorage.getItem('authToken');
let recipesPage = 1;
let isLoadingMore = false;
let hasMoreRecipes = true;

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// API base URL (relative because backend serves frontend on same domain)
const API_BASE = '/api';

// DOM elements
const app = document.getElementById('app');
const authButtons = document.getElementById('auth-buttons');
const userMenu = document.getElementById('user-menu');
const authModal = document.getElementById('auth-modal');
const recipeModal = document.getElementById('recipe-modal');

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await initializeAuth();
  setupEventListeners();
  setupProfilePage();
  setupInfiniteScroll();
  await loadRecipes();
});

// Authentication functions
async function initializeAuth() {
  if (authToken) {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token invalid, remove it
        localStorage.removeItem('authToken');
        authToken = null;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
      authToken = null;
    }
  }
}

function setUser(user) {
  currentUser = user;
  if (user) {
    authButtons.classList.add('hidden');
    userMenu.classList.remove('hidden');
    
    // Set avatar initial
    const avatarInitial = document.getElementById('avatar-initial');
    if (avatarInitial) {
      const initial = (user.username || user.email || 'U').charAt(0).toUpperCase();
      avatarInitial.textContent = initial;
    }
    
    // Set dropdown username
    const userNameDropdown = document.getElementById('user-name-dropdown');
    if (userNameDropdown) {
      userNameDropdown.textContent = user.username || user.email;
    }
    
    // Show admin portal link for admins and moderators
    const adminPortalLink = document.getElementById('admin-portal-link');
    if (adminPortalLink) {
      if (user.role === 'admin' || user.role === 'moderator') {
        adminPortalLink.style.display = 'block';
      } else {
        adminPortalLink.style.display = 'none';
      }
    }
    
    // Initialize notifications
    loadNotifications();
    startNotificationPolling();
    
    loadUserFavorites();
  } else {
    authButtons.classList.remove('hidden');
    userMenu.classList.add('hidden');
    userFavorites = [];
    stopNotificationPolling();
  }
  updateRecipeCards();
}

// Toggle avatar dropdown
function toggleAvatarDropdown() {
  const dropdown = document.querySelector('.dropdown-menu');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const avatarBtn = document.getElementById('avatar-btn');
  const dropdown = document.querySelector('.dropdown-menu');
  
  if (avatarBtn && dropdown && !avatarBtn.contains(e.target)) {
    dropdown.classList.remove('show');
  }
  
  // Close notification dropdown
  const notificationBtn = document.getElementById('notification-btn');
  const notificationDropdown = document.querySelector('.notification-dropdown');
  
  if (notificationBtn && notificationDropdown && !notificationBtn.contains(e.target) && !notificationDropdown.contains(e.target)) {
    notificationDropdown.classList.remove('show');
  }
});

async function signUp(email, password, username, name) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, username, name })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  authToken = data.token;
  localStorage.setItem('authToken', authToken);
  setUser(data.user);
  
  return data;
}

async function signIn(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  authToken = data.token;
  localStorage.setItem('authToken', authToken);
  setUser(data.user);
  
  return data;
}

async function signOut() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  } catch (error) {
    console.error('Logout request failed:', error);
  }

  authToken = null;
  localStorage.removeItem('authToken');
  setUser(null);
}

// Recipe functions
async function loadRecipes(searchTerm = '', cuisine = '', difficulty = '', append = false) {
  try {
    if (append) {
      if (isLoadingMore || !hasMoreRecipes) return;
      isLoadingMore = true;
      document.getElementById('loading-more')?.classList.remove('hidden');
    } else {
      showLoading(true);
      recipesPage = 1;
      hasMoreRecipes = true;
      document.getElementById('no-more-recipes')?.classList.add('hidden');
    }
    
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (cuisine) params.append('cuisine', cuisine);
    if (difficulty) params.append('difficulty', difficulty);
    params.append('page', append ? recipesPage + 1 : 1);
    params.append('limit', 15);

    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/recipes?${params}`, { headers });
    
    if (!response.ok) {
      throw new Error('Failed to fetch recipes');
    }

    const data = await response.json();
    const newRecipes = data.recipes || [];
    
    if (append) {
      recipesPage++;
      recipes = recipes.concat(newRecipes);
      renderRecipes(recipes, 'recipes-grid');
    } else {
      recipes = newRecipes;
      renderRecipes(recipes, 'recipes-grid');
    }
    
    hasMoreRecipes = data.hasMore === true;
    if (!hasMoreRecipes) {
      document.getElementById('no-more-recipes')?.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading recipes:', error);
    showNotification('Error loading recipes', 'error');
  } finally {
    if (append) {
      isLoadingMore = false;
      document.getElementById('loading-more')?.classList.add('hidden');
    } else {
      showLoading(false);
    }
  }
}

async function loadUserRecipes() {
  if (!currentUser) return;

  try {
    const response = await fetch(`${API_BASE}/recipes/user/${currentUser.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user recipes');
    }

    const data = await response.json();
    
    // Add current user info to each recipe with "me" as username
    const recipesWithUserInfo = data.map(recipe => ({
      ...recipe,
      creator_username: 'me',
      creator_name: currentUser.name || currentUser.username,
      creator_id: currentUser.id
    }));
    
    renderRecipes(recipesWithUserInfo || [], 'my-recipes-grid');
  } catch (error) {
    console.error('Error loading user recipes:', error);
    showNotification('Error loading your recipes', 'error');
  }
}

async function loadUserFavorites() {
  if (!currentUser) return;

  try {
    const response = await fetch(`${API_BASE}/recipes/favorites/${currentUser.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch favorites');
    }

    const favoriteRecipes = await response.json();
    userFavorites = favoriteRecipes.map(recipe => recipe.id);
    
    // Update username to "me" for current user's recipes, keep original for others
    const recipesWithUpdatedUsernames = favoriteRecipes.map(recipe => ({
      ...recipe,
      creator_username: recipe.created_by === currentUser.id ? 'me' : (recipe.creator_username || 'Unknown')
    }));
    
    renderRecipes(recipesWithUpdatedUsernames, 'favorites-grid');
  } catch (error) {
    console.error('Error loading favorites:', error);
  }
}

async function toggleFavorite(recipeId) {
  if (!currentUser) {
    showAuthModal();
    return;
  }

  try {
    const isFavorite = userFavorites.includes(parseInt(recipeId));
    const method = isFavorite ? 'DELETE' : 'POST';
    const url = `${API_BASE}/recipes/favorites/${recipeId}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to update favorites');
    }

    if (isFavorite) {
      userFavorites = userFavorites.filter(id => id !== parseInt(recipeId));
    } else {
      userFavorites.push(parseInt(recipeId));
    }

    updateRecipeCards();
    if (currentPage === 'favorites') {
      loadUserFavorites();
    }

    showNotification(
      isFavorite ? 'Removed from favorites' : 'Added to favorites',
      'success'
    );
  } catch (error) {
    console.error('Error toggling favorite:', error);
    showNotification('Error updating favorites', 'error');
  }
}

async function createRecipe(recipeData) {
  if (!currentUser) {
    showAuthModal();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(recipeData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create recipe');
    }

    const data = await response.json();
    showNotification('Recipe created successfully!', 'success');
    showPage('home');
    await loadRecipes();
    return data;
  } catch (error) {
    console.error('Error creating recipe:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

async function updateRecipe(recipeId, recipeData) {
  if (!currentUser) {
    showAuthModal();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(recipeData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update recipe');
    }

    const data = await response.json();
    showNotification('Recipe updated successfully!', 'success');
    closeRecipeModal();
    
    // Refresh the appropriate view
    if (currentPage === 'home') {
      await loadRecipes();
    } else if (currentPage === 'my-recipes') {
      await loadUserRecipes();
    }
    
    return data;
  } catch (error) {
    console.error('Error updating recipe:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

async function deleteRecipe(recipeId) {
  if (!currentUser) {
    showAuthModal();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete recipe');
    }

    showNotification('Recipe deleted successfully!', 'success');
    
    // Remove from userFavorites array if present
    const index = userFavorites.indexOf(parseInt(recipeId));
    if (index > -1) {
      userFavorites.splice(index, 1);
    }
    
    // Reload statistics if on profile page
    if (currentPage === 'profile') {
      await loadUserStatistics();
    }
    
    // Refresh the appropriate view
    if (currentPage === 'home') {
      await loadRecipes();
    } else if (currentPage === 'my-recipes') {
      await loadUserRecipes();
    } else if (currentPage === 'favorites') {
      await loadUserFavorites();
    }
  } catch (error) {
    console.error('Error deleting recipe:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

function confirmDeleteRecipe(recipeId) {
  showConfirmModal(
    'Delete Recipe',
    'Are you sure you want to delete this recipe? This action cannot be undone.',
    async () => {
      await deleteRecipe(recipeId);
    }
  );
}

// Delete recipe from detail modal (for moderators/admins)
async function deleteRecipeFromDetail(recipeId) {
  showConfirmModal(
    'Delete Recipe',
    'Are you sure you want to delete this recipe? This action cannot be undone.',
    async () => {
      try {
        await deleteRecipe(recipeId);
        closeRecipeModal();
        showNotification('Recipe deleted successfully!', 'success');
      } catch (error) {
        // Error already handled in deleteRecipe
      }
    }
  );
}

function editRecipe(recipeId) {
  // Close the recipe detail modal first
  closeRecipeModal();
  
  // Navigate to add recipe page
  showPage('add-recipe');
  
  // Update the page header to indicate editing
  const pageHeader = document.querySelector('#add-recipe-page .page-header h2');
  if (pageHeader) {
    pageHeader.textContent = 'Edit Recipe';
  }
  
  // Load the recipe data into the form
  loadRecipeIntoForm(recipeId);
}

async function loadRecipeIntoForm(recipeId) {
  try {
    const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch recipe details');
    }

    const recipe = await response.json();
    
    // Store the recipe ID for updating
    document.getElementById('recipe-form').dataset.recipeId = recipeId;
    
    // Populate the form fields
    document.getElementById('recipe-title').value = recipe.title || '';
    document.getElementById('recipe-description').value = recipe.description || '';
    document.getElementById('recipe-cuisine').value = recipe.cuisine || '';
    document.getElementById('recipe-prep-time').value = recipe.prep_time || 0;
    document.getElementById('recipe-cook-time').value = recipe.cook_time || 0;
    document.getElementById('recipe-servings').value = recipe.servings || 1;
    document.getElementById('recipe-difficulty').value = recipe.difficulty || 'easy';
    // Set existing image preview
    const uploadArea = document.getElementById('image-upload-area');
    const preview = document.getElementById('recipe-image-preview');
    const placeholder = uploadArea.querySelector('.image-upload-placeholder');
    if (recipe.image_url) {
      preview.src = recipe.image_url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      uploadArea.dataset.imageUrl = recipe.image_url;
    } else {
      preview.style.display = 'none';
      preview.src = '';
      placeholder.style.display = '';
      delete uploadArea.dataset.imageUrl;
    }
    
    // Populate ingredients
    const ingredientsContainer = document.getElementById('ingredients-container');
    ingredientsContainer.innerHTML = '';
    (recipe.ingredients || []).forEach(ingredient => {
      addIngredient(ingredient);
    });
    
    // Populate instructions
    const instructionsContainer = document.getElementById('instructions-container');
    instructionsContainer.innerHTML = '';
    (recipe.instructions || []).forEach(instruction => {
      addInstruction(instruction);
    });
    
    // Update the submit button text
    const submitBtn = document.querySelector('#recipe-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Update Recipe';
    }
    
    showNotification('Recipe loaded for editing', 'success');
  } catch (error) {
    console.error('Error loading recipe for editing:', error);
    showNotification('Error loading recipe details', 'error');
  }
}

// UI functions
function renderRecipes(recipesData, containerId) {
  const container = document.getElementById(containerId);
  
  if (!recipesData || recipesData.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="grid-column: 1 / -1;">
        <p class="text-muted">No recipes found.</p>
      </div>
    `;
    return;
  }

  // Check if this is the "My Recipes" section
  const isMyRecipes = containerId === 'my-recipes-grid';

  container.innerHTML = recipesData.map(recipe => {
    const isOwnRecipe = currentUser && recipe.created_by === currentUser.id;
    const creatorName = escapeHtml(recipe.creator_name || recipe.creator_username || 'Unknown');
    const creatorUsername = escapeHtml(recipe.creator_username || '');
    const creatorId = recipe.creator_id || recipe.created_by;
    const title = escapeHtml(recipe.title);
    const description = escapeHtml(recipe.description || 'No description available');
    const cuisine = recipe.cuisine ? escapeHtml(recipe.cuisine) : '';
    const difficulty = escapeHtml(recipe.difficulty || 'easy');
    const imageUrl = escapeHtml(recipe.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg');

    return `
    <div class="recipe-card" data-recipe-id="${recipe.id}">
      <img 
        src="${imageUrl}" 
        alt="${title}"
        class="recipe-image"
        onerror="this.src='https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'"
      >
      <div class="recipe-content">
        <h3 class="recipe-title">${title}</h3>
        <p class="recipe-description">${description}</p>
        <div class="recipe-meta">
          <span>⏱️ ${(recipe.prep_time || 0) + (recipe.cook_time || 0)} min</span>
          <span>🍽️ ${recipe.servings || 1} servings</span>
        </div>
        <div class="recipe-tags">
          ${cuisine ? `<span class="recipe-tag cuisine">${cuisine}</span>` : ''}
          <span class="recipe-tag difficulty">${difficulty}</span>
        </div>
        <div class="recipe-actions">
          ${isMyRecipes ? `
            <button class="delete-btn" 
                    data-recipe-id="${recipe.id}"
                    title="Delete recipe">
              🗑️
            </button>
          ` : `
            <button class="favorite-btn ${userFavorites.includes(recipe.id) ? 'active' : ''}" 
                    data-recipe-id="${recipe.id}">
              ❤️
            </button>
          `}
          <button class="btn btn-outline" onclick="showRecipeDetail('${recipe.id}')">
            View Recipe
          </button>
          ${creatorId ? `
            <span class="recipe-creator-inline">
              <a href="#" class="creator-link" data-creator-id="${creatorId}" onclick="event.stopPropagation(); showUserProfile(${creatorId}); return false;">@${creatorUsername || creatorName}</a>
            </span>
          ` : ''}
        </div>
      </div>
    </div>
    `;
  }).join('');

  // Add event listeners for favorite buttons
  container.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const recipeId = btn.dataset.recipeId;
      toggleFavorite(recipeId);
    });
  });

  // Add event listeners for delete buttons
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const recipeId = btn.dataset.recipeId;
      confirmDeleteRecipe(recipeId);
    });
  });

  // Add event listeners for recipe cards
  container.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, a, .favorite-btn, .delete-btn')) return;
      const recipeId = card.dataset.recipeId;
      showRecipeDetail(recipeId);
    });
  });
}

function updateRecipeCards() {
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    const recipeId = parseInt(btn.dataset.recipeId);
    if (userFavorites.includes(recipeId)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

async function showRecipeDetail(recipeId) {
  try {
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/recipes/${recipeId}`, { headers });
    
    if (!response.ok) {
      throw new Error('Failed to fetch recipe details');
    }

    const recipe = await response.json();

    // Check if this is the user's own recipe or if user is moderator/admin
    const isOwnRecipe = currentUser && recipe.created_by === currentUser.id;
    const canModerate = currentUser && (currentUser.role === 'moderator' || currentUser.role === 'admin');
    const canEdit = isOwnRecipe;
    const canDelete = isOwnRecipe || canModerate;
    const creatorId = recipe.creator_id || recipe.created_by;
    const creatorUsername = escapeHtml(recipe.creator_username || '');
    const creatorName = escapeHtml(recipe.creator_name || 'Unknown');
    const recipeTitle = escapeHtml(recipe.title);
    const recipeDesc = escapeHtml(recipe.description || 'No description available');
    const recipeDiff = escapeHtml(recipe.difficulty || 'easy');
    const recipeCuisine = recipe.cuisine ? escapeHtml(recipe.cuisine) : '';
    const recipeImage = escapeHtml(recipe.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg');
    const safeIngredients = (recipe.ingredients || []).map(i => escapeHtml(i));
    const safeInstructions = (recipe.instructions || []).map(i => escapeHtml(i));

    document.getElementById('recipe-modal-title').textContent = recipe.title;
    document.getElementById('recipe-modal-body').innerHTML = `
      <div class="recipe-detail">
        <div class="recipe-detail-header">
          ${canEdit ? `
            <button class="edit-recipe-btn" onclick="editRecipe(${recipe.id})" title="Edit recipe">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit Recipe
            </button>
          ` : ''}
          ${creatorId && !isOwnRecipe ? `
            <div class="recipe-creator-info">
              <span>Created by: <a href="#" onclick="showUserProfile(${creatorId}); return false;" class="creator-link">@${creatorUsername || creatorName}</a></span>
              <div class="recipe-creator-actions">
                ${currentUser ? `<button class="btn btn-primary" id="follow-user-btn" data-user-id="${creatorId}">Follow</button>` : ''}
                ${canDelete ? `<button class="btn btn-danger" onclick="deleteRecipeFromDetail(${recipe.id})">🗑️ Delete</button>` : ''}
              </div>
            </div>
          ` : ''}
          <img 
            src="${recipeImage}" 
            alt="${recipeTitle}"
            class="recipe-detail-image"
            onerror="this.src='https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'"
          >
          <h3 class="recipe-detail-title">${recipeTitle}</h3>
          <p class="recipe-detail-description">${recipeDesc}</p>
          <div class="recipe-detail-meta">
            <span><strong>Prep Time:</strong> ${recipe.prep_time || 0} min</span>
            <span><strong>Cook Time:</strong> ${recipe.cook_time || 0} min</span>
            <span><strong>Servings:</strong> ${recipe.servings || 1}</span>
            <span><strong>Difficulty:</strong> ${recipeDiff}</span>
            ${recipeCuisine ? `<span><strong>Cuisine:</strong> ${recipeCuisine}</span>` : ''}
          </div>
        </div>
          <div class="recipe-detail-info">
          <div class="recipe-feedback" data-recipe-id="${recipe.id}">
            <button class="feedback-btn like-btn" data-recipe-id="${recipe.id}" title="Like this recipe">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 10v12"></path>
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path>
              </svg>
              <span class="feedback-count">0</span>
            </button>
            <button class="feedback-btn dislike-btn" data-recipe-id="${recipe.id}" title="Dislike this recipe">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 14V2"></path>
                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path>
              </svg>
              <span class="feedback-count">0</span>
            </button>
          </div>
          
          <!-- Rating Section -->
          <div class="recipe-rating-section" data-recipe-id="${recipe.id}">
            <h4>Rate this Recipe</h4>
            <div class="rating-display">
              <div class="average-rating">
                <span class="rating-number">0.0</span>
                <div class="rating-stars">
                  ${generateStarDisplay(0)}
                </div>
              </div>
              <div class="rating-stats">
                <span class="total-ratings">0 ratings</span>
                <span class="tried-count">0 people tried it</span>
              </div>
            </div>
            
            <div id="user-rating-display" class="user-rating-display" style="display: none;">
              <!-- User's rating will be shown here -->
            </div>
            
            <div id="rating-form" class="rating-form">
              <h5>Your Rating</h5>
              <div class="star-rating-input">
                ${[1, 2, 3, 4, 5].map(star => `
                  <button class="star-btn" data-rating="${star}">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </button>
                `).join('')}
              </div>
              
              <div class="tried-it-section">
                <label>Did you try it?</label>
                <div class="tried-it-buttons">
                  <button class="tried-btn" data-tried="true">Yes</button>
                  <button class="tried-btn" data-tried="false">No</button>
                </div>
              </div>
              
              <textarea 
                id="rating-review-input" 
                class="rating-review-input" 
                placeholder="Share your experience with this recipe (optional)..."
                maxlength="500"
              ></textarea>
              
              <div class="rating-form-actions">
                <button class="btn btn-secondary" id="cancel-rating-btn">Cancel</button>
                <button class="btn btn-primary" id="submit-rating-btn" disabled>Submit Rating</button>
              </div>
            </div>
          </div>
          
          <div class="recipe-sections">
            <div class="ingredients-section">
              <h4>Ingredients</h4>
              <ul class="ingredients-list">
                ${safeIngredients.map(ingredient => `<li>${ingredient}</li>`).join('')}
              </ul>
            </div>
            <div class="instructions-section">
              <h4>Instructions</h4>
              <ol class="instructions-list">
                ${safeInstructions.map(instruction => `<li>${instruction}</li>`).join('')}
              </ol>
            </div>
          </div>
        </div>
        <div class="comments-section">
          <h4>Comments</h4>
          <div class="comment-form">
            <textarea 
              id="comment-input" 
              placeholder="Add a comment (max 150 words)..." 
              maxlength="750"
              rows="3"
            ></textarea>
            <div class="comment-form-actions">
              <span class="char-count">0/750 characters</span>
              <button class="btn btn-primary" id="submit-comment-btn">Post Comment</button>
            </div>
          </div>
          <div id="comments-list" class="comments-list">
            <!-- Comments will be loaded here -->
          </div>
        </div>
      </div>
    `;

    recipeModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load and setup feedback buttons
    await loadRecipeLikes(recipe.id);
    setupFeedbackButtons();
    
    // Load and setup rating section
    await loadRecipeRatings(recipe.id);
    setupRatingForm(recipe.id);
    
    // Setup follow button - needs to wait for DOM to be updated
    if (creatorId && !isOwnRecipe && currentUser) {
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => setupFollowButton(creatorId), 0);
    }
    
    // Load comments
    await loadComments(recipe.id);
    setupCommentForm(recipe.id);
  } catch (error) {
    console.error('Error loading recipe detail:', error);
    showNotification('Error loading recipe details', 'error');
  }
}

// Helper function to generate star display
function generateStarDisplay(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  let html = '';
  
  // Full stars
  for (let i = 0; i < fullStars; i++) {
    html += `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1.5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    `;
  }
  
  // Half star
  if (hasHalfStar) {
    html += `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5">
        <defs>
          <linearGradient id="half-fill">
            <stop offset="50%" stop-color="#f59e0b"/>
            <stop offset="50%" stop-color="transparent"/>
          </linearGradient>
        </defs>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#half-fill)"/>
      </svg>
    `;
  }
  
  // Empty stars
  for (let i = 0; i < emptyStars; i++) {
    html += `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    `;
  }
  
  return html;
}

function closeRecipeModal() {
  recipeModal.classList.remove('active');
  document.body.style.overflow = '';
}

// Load recipe likes/dislikes from backend
async function loadRecipeLikes(recipeId) {
  try {
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/recipes/${recipeId}/likes`, {
      headers
    });

    if (response.ok) {
      const data = await response.json();
      const likeBtn = document.querySelector('.recipe-feedback .like-btn');
      const dislikeBtn = document.querySelector('.recipe-feedback .dislike-btn');

      if (likeBtn && dislikeBtn) {
        // Update counts
        likeBtn.querySelector('.feedback-count').textContent = data.likes;
        dislikeBtn.querySelector('.feedback-count').textContent = data.dislikes;

        // Update user's selection
        likeBtn.classList.remove('active');
        dislikeBtn.classList.remove('active');
        
        if (data.userLike === 'like') {
          likeBtn.classList.add('active');
        } else if (data.userLike === 'dislike') {
          dislikeBtn.classList.add('active');
        }
      }
    }
  } catch (error) {
    console.error('Error loading recipe likes:', error);
  }
}

// Feedback button functionality
function setupFeedbackButtons() {
  const feedbackBtns = document.querySelectorAll('.feedback-btn');
  feedbackBtns.forEach(btn => {
    btn.addEventListener('click', handleFeedbackClick);
  });
}

async function handleFeedbackClick(e) {
  const btn = e.currentTarget;
  const recipeId = btn.dataset.recipeId;
  const isLike = btn.classList.contains('like-btn');
  const likeType = isLike ? 'like' : 'dislike';
  
  // Check if user is logged in
  if (!currentUser) {
    showNotification('Please login to like or dislike recipes', 'error');
    // Close recipe modal before opening login
    recipeModal.classList.remove('active');
    document.getElementById('login-btn').click();
    return;
  }
  
  // Get both buttons
  const container = btn.closest('.recipe-feedback');
  const likeBtn = container.querySelector('.like-btn');
  const dislikeBtn = container.querySelector('.dislike-btn');
  const wasActive = btn.classList.contains('active');
  
  try {
    let response;
    
    if (wasActive) {
      // Remove like/dislike
      response = await fetch(`${API_BASE}/recipes/${recipeId}/likes`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } else {
      // Add or update like/dislike
      response = await fetch(`${API_BASE}/recipes/${recipeId}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ likeType })
      });
    }
    
    if (response.ok) {
      const data = await response.json();
      
      // Update UI
      likeBtn.classList.remove('active');
      dislikeBtn.classList.remove('active');
      
      if (data.userLike === 'like') {
        likeBtn.classList.add('active');
      } else if (data.userLike === 'dislike') {
        dislikeBtn.classList.add('active');
      }
      
      // Update counts
      likeBtn.querySelector('.feedback-count').textContent = data.likes;
      dislikeBtn.querySelector('.feedback-count').textContent = data.dislikes;
      
      showNotification(wasActive ? 'Feedback removed' : `Recipe ${likeType}d!`, 'success');
    } else {
      throw new Error('Failed to update feedback');
    }
  } catch (error) {
    console.error('Error updating feedback:', error);
    showNotification('Failed to update feedback', 'error');
  }
}

// Load recipe ratings from backend
async function loadRecipeRatings(recipeId) {
  try {
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/recipes/${recipeId}/ratings`, {
      headers
    });

    if (response.ok) {
      const data = await response.json();
      updateRatingDisplay(data);
    }
  } catch (error) {
    console.error('Error loading recipe ratings:', error);
  }
}

// Update rating display
function updateRatingDisplay(data) {
  const ratingSection = document.querySelector('.recipe-rating-section');
  if (!ratingSection) return;

  // Update average rating
  const ratingNumber = ratingSection.querySelector('.rating-number');
  const ratingStars = ratingSection.querySelector('.rating-stars');
  const totalRatings = ratingSection.querySelector('.total-ratings');
  const triedCount = ratingSection.querySelector('.tried-count');

  if (ratingNumber) ratingNumber.textContent = data.averageRating.toFixed(1);
  if (ratingStars) ratingStars.innerHTML = generateStarDisplay(data.averageRating);
  if (totalRatings) totalRatings.textContent = `${data.totalRatings} ${data.totalRatings === 1 ? 'rating' : 'ratings'}`;
  if (triedCount) triedCount.textContent = `${data.triedCount} ${data.triedCount === 1 ? 'person' : 'people'} tried it`;

  // Show/hide user rating display and form
  const userRatingDisplay = document.getElementById('user-rating-display');
  const ratingForm = document.getElementById('rating-form');

  if (data.userRating && userRatingDisplay) {
    // Show user's existing rating
    userRatingDisplay.style.display = 'block';
    userRatingDisplay.innerHTML = `
      <h5>Your Rating</h5>
      <div class="user-rating-info">
        <div class="user-rating-stars">
          ${[1, 2, 3, 4, 5].map(star => `
            <svg viewBox="0 0 24 24" fill="${star <= data.userRating.rating ? '#f59e0b' : 'none'}" stroke="${star <= data.userRating.rating ? '#f59e0b' : '#d1d5db'}">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          `).join('')}
        </div>
        ${data.userRating.triedIt ? '<span class="tried-badge">✓ I tried it!</span>' : ''}
      </div>
      ${data.userRating.reviewComment ? `<p class="user-review-text">${escapeHtml(data.userRating.reviewComment)}</p>` : ''}
      <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary btn-sm" id="edit-rating-btn">Edit Rating</button>
        <button class="btn btn-secondary btn-sm" id="delete-rating-btn">Delete Rating</button>
      </div>
    `;
    
    if (ratingForm) ratingForm.style.display = 'none';

    // Setup edit/delete buttons
    const editBtn = document.getElementById('edit-rating-btn');
    const deleteBtn = document.getElementById('delete-rating-btn');
    
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        userRatingDisplay.style.display = 'none';
        ratingForm.style.display = 'block';
        
        // Pre-fill form with existing rating
        const stars = document.querySelectorAll('.star-btn');
        stars.forEach((star, index) => {
          if (index < data.userRating.rating) {
            star.classList.add('active');
          }
        });
        
        const triedBtns = document.querySelectorAll('.tried-btn');
        triedBtns.forEach(btn => {
          if (btn.dataset.tried === String(data.userRating.triedIt)) {
            btn.classList.add('active');
          }
        });
        
        const reviewInput = document.getElementById('rating-review-input');
        if (reviewInput && data.userRating.reviewComment) {
          reviewInput.value = data.userRating.reviewComment;
        }
        
        // Set the rating value in the form's scope by triggering the setupRatingForm with pre-filled data
        const recipeId = ratingSection.dataset.recipeId;
        setupRatingForm(recipeId, data.userRating);
        
        document.getElementById('submit-rating-btn').disabled = false;
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        await deleteRating(ratingSection.dataset.recipeId);
      });
    }
  } else {
    // Show rating form
    if (userRatingDisplay) userRatingDisplay.style.display = 'none';
    if (ratingForm) ratingForm.style.display = 'block';
  }
}

// Setup rating form
function setupRatingForm(recipeId, existingRating = null) {
  const ratingForm = document.getElementById('rating-form');
  if (!ratingForm) return;

  let selectedRating = existingRating ? existingRating.rating : 0;
  let selectedTried = existingRating ? existingRating.triedIt : null;

  // Star rating interaction
  const starBtns = document.querySelectorAll('.star-btn');
  starBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      if (!currentUser) {
        showNotification('Please login to rate recipes', 'error');
        recipeModal.classList.remove('active');
        document.getElementById('login-btn').click();
        return;
      }

      selectedRating = parseInt(btn.dataset.rating);
      
      // Update visual state
      starBtns.forEach((s, i) => {
        if (i < selectedRating) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
      
      // Enable submit button if rating is selected
      document.getElementById('submit-rating-btn').disabled = false;
    });
  });

  // Tried it buttons
  const triedBtns = document.querySelectorAll('.tried-btn');
  triedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentUser) {
        showNotification('Please login to rate recipes', 'error');
        recipeModal.classList.remove('active');
        document.getElementById('login-btn').click();
        return;
      }

      selectedTried = btn.dataset.tried === 'true';
      
      // Update visual state
      triedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Submit rating
  const submitBtn = document.getElementById('submit-rating-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!currentUser) {
        showNotification('Please login to rate recipes', 'error');
        return;
      }

      if (selectedRating === 0) {
        showNotification('Please select a rating', 'error');
        return;
      }

      const reviewInput = document.getElementById('rating-review-input');
      const reviewComment = reviewInput ? reviewInput.value.trim() : '';

      try {
        const response = await fetch(`${API_BASE}/recipes/${recipeId}/ratings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            rating: selectedRating,
            triedIt: selectedTried !== null ? selectedTried : false,
            reviewComment: reviewComment || null
          })
        });

        if (response.ok) {
          const data = await response.json();
          updateRatingDisplay(data);
          
          // Reset form
          selectedRating = 0;
          selectedTried = null;
          starBtns.forEach(s => s.classList.remove('active'));
          triedBtns.forEach(b => b.classList.remove('active'));
          if (reviewInput) reviewInput.value = '';
          submitBtn.disabled = true;
          
          showNotification('Rating submitted successfully!', 'success');
        } else {
          throw new Error('Failed to submit rating');
        }
      } catch (error) {
        console.error('Error submitting rating:', error);
        showNotification('Failed to submit rating', 'error');
      }
    });
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancel-rating-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // Reset form
      selectedRating = 0;
      selectedTried = null;
      starBtns.forEach(s => s.classList.remove('active'));
      triedBtns.forEach(b => b.classList.remove('active'));
      const reviewInput = document.getElementById('rating-review-input');
      if (reviewInput) reviewInput.value = '';
      submitBtn.disabled = true;
    });
  }
}

// Delete rating
async function deleteRating(recipeId) {
  try {
    const response = await fetch(`${API_BASE}/recipes/${recipeId}/ratings`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      updateRatingDisplay(data);
      showNotification('Rating deleted successfully', 'success');
    } else {
      throw new Error('Failed to delete rating');
    }
  } catch (error) {
    console.error('Error deleting rating:', error);
    showNotification('Failed to delete rating', 'error');
  }
}

// Comment functionality
async function loadComments(recipeId) {
  try {
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/recipes/${recipeId}/comments`, {
      headers
    });

    if (response.ok) {
      const data = await response.json();
      displayComments(data.comments, recipeId);
    }
  } catch (error) {
    console.error('Error loading comments:', error);
  }
}

function displayComments(comments, recipeId) {
  const commentsList = document.getElementById('comments-list');
  
  if (!comments || comments.length === 0) {
    commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
    return;
  }

  // Create a map of all comments by id for easy lookup
  const commentsById = {};
  comments.forEach(comment => {
    commentsById[comment.id] = comment;
  });

  // Separate parent comments and build replies map for all comments
  const parentComments = comments.filter(c => !c.parent_comment_id);
  const repliesMap = {};
  
  // Build a map of all replies grouped by their parent
  comments.forEach(comment => {
    if (comment.parent_comment_id) {
      if (!repliesMap[comment.parent_comment_id]) {
        repliesMap[comment.parent_comment_id] = [];
      }
      repliesMap[comment.parent_comment_id].push(comment);
    }
  });

  // Recursive function to get all nested replies
  function getNestedReplies(commentId) {
    const directReplies = repliesMap[commentId] || [];
    return directReplies.map(reply => ({
      ...reply,
      replies: getNestedReplies(reply.id)
    }));
  }

  commentsList.innerHTML = parentComments.map(comment => {
    const nestedReplies = getNestedReplies(comment.id);
    return renderComment(comment, nestedReplies, recipeId, commentsById);
  }).join('');

  // Setup comment interaction buttons
  setupCommentInteractions();
}

function renderComment(comment, replies = [], recipeId, commentsById = {}) {
  const timeAgo = getTimeAgo(new Date(comment.created_at));
  const repliesHTML = replies.length > 0 ? `
    <div class="comment-replies">
      ${replies.map(reply => renderComment(reply, reply.replies || [], recipeId, commentsById)).join('')}
    </div>
  ` : '';

  const canDelete = currentUser && (currentUser.id === comment.user_id || currentUser.role === 'moderator' || currentUser.role === 'admin');
  
  const parentComment = comment.parent_comment_id ? commentsById[comment.parent_comment_id] : null;
  const parentUsername = parentComment ? escapeHtml(parentComment.user_username || parentComment.user_name || parentComment.user_email) : '';
  const commentText = escapeHtml(comment.comment_text);
  const commentUsername = escapeHtml(comment.user_username || comment.user_name || comment.user_email);
  const replyingTo = parentComment ? `
    <div class="replying-to">
      Replying to <a href="#" class="replying-to-user" onclick="event.preventDefault(); showUserProfile(${parentComment.user_id}); return false;">@${parentUsername}</a>
    </div>
  ` : '';
  
  return `
    <div class="comment" data-comment-id="${comment.id}">
      <div class="comment-header">
        <a href="#" class="comment-author" onclick="event.preventDefault(); showUserProfile(${comment.user_id}); return false;">@${commentUsername}</a>
        <div class="comment-header-right">
          <span class="comment-time">${timeAgo}</span>
          ${canDelete ? `<button class="comment-delete-btn" data-comment-id="${comment.id}" title="Delete comment">&times;</button>` : ''}
        </div>
      </div>
      ${replyingTo}
      <div class="comment-body">${commentText}</div>
      <div class="comment-actions">
        <button class="comment-action-btn comment-like-btn ${comment.userLike === 'like' ? 'active' : ''}" 
                data-comment-id="${comment.id}" 
                data-action="like">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 10v12"></path>
            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path>
          </svg>
          <span>${comment.likes || 0}</span>
        </button>
        <button class="comment-action-btn comment-dislike-btn ${comment.userLike === 'dislike' ? 'active' : ''}" 
                data-comment-id="${comment.id}" 
                data-action="dislike">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 14V2"></path>
            <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path>
          </svg>
          <span>${comment.dislikes || 0}</span>
        </button>
        <button class="comment-action-btn comment-reply-btn" data-comment-id="${comment.id}" data-parent-id="${comment.parent_comment_id || comment.id}">Reply</button>
      </div>
      <div class="reply-form-container" id="reply-form-${comment.id}" style="display: none;"></div>
      ${repliesHTML}
    </div>
  `;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

function setupCommentForm(recipeId) {
  const commentInput = document.getElementById('comment-input');
  const charCount = document.querySelector('.char-count');
  const submitBtn = document.getElementById('submit-comment-btn');

  // Update character count
  commentInput.addEventListener('input', () => {
    charCount.textContent = `${commentInput.value.length}/750 characters`;
  });

  // Submit comment
  submitBtn.addEventListener('click', async () => {
    await submitComment(recipeId, commentInput.value);
  });
}

async function submitComment(recipeId, commentText, parentCommentId = null) {
  if (!currentUser) {
    showNotification('Please login to comment', 'error');
    recipeModal.classList.remove('active');
    document.getElementById('login-btn').click();
    return;
  }

  if (!commentText || commentText.trim().length === 0) {
    showNotification('Please enter a comment', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/recipes/${recipeId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ commentText: commentText.trim(), parentCommentId })
    });

    if (response.ok) {
      showNotification('Comment posted!', 'success');
      document.getElementById('comment-input').value = '';
      document.querySelector('.char-count').textContent = '0/750 characters';
      
      // Hide all reply forms
      document.querySelectorAll('.reply-form-container').forEach(container => {
        container.style.display = 'none';
      });
      
      // Reload comments
      await loadComments(recipeId);
    } else {
      const data = await response.json();
      throw new Error(data.error || 'Failed to post comment');
    }
  } catch (error) {
    console.error('Error posting comment:', error);
    showNotification(error.message, 'error');
  }
}

function setupCommentInteractions() {
  // Like/dislike buttons
  document.querySelectorAll('.comment-like-btn, .comment-dislike-btn').forEach(btn => {
    btn.addEventListener('click', handleCommentLike);
  });

  // Reply buttons
  document.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', handleCommentReply);
  });
  
  // Delete buttons
  document.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', handleCommentDelete);
  });
}

async function handleCommentLike(e) {
  const btn = e.currentTarget;
  const commentId = btn.dataset.commentId;
  const action = btn.dataset.action;
  
  if (!currentUser) {
    showNotification('Please login to like comments', 'error');
    recipeModal.classList.remove('active');
    document.getElementById('login-btn').click();
    return;
  }

  const wasActive = btn.classList.contains('active');
  
  try {
    let response;
    
    if (wasActive) {
      response = await fetch(`${API_BASE}/recipes/comments/${commentId}/likes`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } else {
      response = await fetch(`${API_BASE}/recipes/comments/${commentId}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ likeType: action })
      });
    }
    
    if (response.ok) {
      const data = await response.json();
      
      // Update UI
      const comment = btn.closest('.comment');
      const likeBtn = comment.querySelector('.comment-like-btn');
      const dislikeBtn = comment.querySelector('.comment-dislike-btn');
      
      likeBtn.classList.remove('active');
      dislikeBtn.classList.remove('active');
      
      if (data.userLike === 'like') {
        likeBtn.classList.add('active');
      } else if (data.userLike === 'dislike') {
        dislikeBtn.classList.add('active');
      }
      
      likeBtn.querySelector('span').textContent = data.likes;
      dislikeBtn.querySelector('span').textContent = data.dislikes;
    }
  } catch (error) {
    console.error('Error updating comment like:', error);
    showNotification('Failed to update like', 'error');
  }
}

function handleCommentReply(e) {
  const btn = e.currentTarget;
  const commentId = btn.dataset.commentId;
  const parentId = btn.dataset.parentId;
  const replyFormContainer = document.getElementById(`reply-form-${commentId}`);
  
  if (!currentUser) {
    showNotification('Please login to reply', 'error');
    recipeModal.classList.remove('active');
    document.getElementById('login-btn').click();
    return;
  }
  
  // Close all other reply forms
  document.querySelectorAll('.reply-form-container').forEach(container => {
    if (container.id !== `reply-form-${commentId}`) {
      container.style.display = 'none';
    }
  });
  
  // Toggle reply form
  if (replyFormContainer.style.display === 'none') {
    const recipeId = btn.closest('.recipe-detail').querySelector('.recipe-feedback').dataset.recipeId;
    replyFormContainer.innerHTML = `
      <div class="reply-form">
        <textarea class="reply-input" placeholder="Write a reply..." maxlength="750" rows="2"></textarea>
        <div class="reply-actions">
          <button class="btn btn-sm btn-outline cancel-reply-btn">Cancel</button>
          <button class="btn btn-sm btn-primary submit-reply-btn">Reply</button>
        </div>
      </div>
    `;
    replyFormContainer.style.display = 'block';
    
    // Setup reply form buttons
    const replyInput = replyFormContainer.querySelector('.reply-input');
    const cancelBtn = replyFormContainer.querySelector('.cancel-reply-btn');
    const submitBtn = replyFormContainer.querySelector('.submit-reply-btn');
    
    cancelBtn.addEventListener('click', () => {
      replyFormContainer.style.display = 'none';
    });
    
    submitBtn.addEventListener('click', async () => {
      await submitComment(recipeId, replyInput.value, parentId);
    });
    
    // Focus on textarea
    replyInput.focus();
  } else {
    replyFormContainer.style.display = 'none';
  }
}

async function handleCommentDelete(e) {
  const btn = e.currentTarget;
  const commentId = btn.dataset.commentId;
  
  // Show custom confirmation modal
  const confirmed = await showConfirmModal(
    'Delete Comment',
    'Are you sure you want to delete this comment? This will also delete all replies.',
    'Delete'
  );
  
  if (!confirmed) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/recipes/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      showNotification('Comment deleted successfully', 'success');
      
      // Reload comments
      const recipeId = btn.closest('.recipe-detail').querySelector('.recipe-feedback').dataset.recipeId;
      await loadComments(recipeId);
    } else {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete comment');
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    showNotification(error.message, 'error');
  }
}

// Custom confirmation modal
function showConfirmModal(title, message, callbackOrText = 'OK') {
  // Support both callback and Promise patterns
  const isCallback = typeof callbackOrText === 'function';
  const confirmText = isCallback ? 'Delete' : callbackOrText;
  const callback = isCallback ? callbackOrText : null;
  
  return new Promise((resolve) => {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = confirmText;
    
    confirmModal.classList.add('active');
    
    const handleConfirm = async () => {
      confirmModal.classList.remove('active');
      cleanup();
      if (callback) {
        await callback();
      }
      resolve(true);
    };
    
    const handleCancel = () => {
      confirmModal.classList.remove('active');
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      confirmOkBtn.removeEventListener('click', handleConfirm);
      confirmCancelBtn.removeEventListener('click', handleCancel);
    };
    
    confirmOkBtn.addEventListener('click', handleConfirm);
    confirmCancelBtn.addEventListener('click', handleCancel);
  });
}

function showPage(pageName) {
  // Update navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === pageName) {
      link.classList.add('active');
    }
  });

  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(`${pageName}-page`).classList.add('active');

  currentPage = pageName;

  // Load page-specific data
  if (pageName === 'home') {
    // Reset search filters when going to home
    const searchInput = document.getElementById('search-input');
    const cuisineFilter = document.getElementById('cuisine-filter');
    const difficultyFilter = document.getElementById('difficulty-filter');
    
    if (searchInput) searchInput.value = '';
    if (cuisineFilter) cuisineFilter.value = '';
    if (difficultyFilter) difficultyFilter.value = '';
    
    // Reload all recipes
    loadRecipes();
  } else if (pageName === 'my-recipes') {
    if (!currentUser) {
      showAuthModal();
      showPage('home');
      return;
    }
    loadUserRecipes();
  } else if (pageName === 'favorites') {
    if (!currentUser) {
      showAuthModal();
      showPage('home');
      return;
    }
    loadUserFavorites();
  } else if (pageName === 'profile') {
    if (!currentUser) {
      showAuthModal();
      showPage('home');
      return;
    }
    loadUserProfile();
  } else if (pageName === 'add-recipe') {
    // Reset the page header and form when navigating normally
    const pageHeader = document.querySelector('#add-recipe-page .page-header h2');
    if (pageHeader) {
      pageHeader.textContent = 'Add New Recipe';
    }
    const form = document.getElementById('recipe-form');
    if (form) {
      delete form.dataset.recipeId;
      form.reset();
      
      // Reset ingredients container
      const ingredientsContainer = document.getElementById('ingredients-container');
      if (ingredientsContainer) {
        ingredientsContainer.innerHTML = `
          <div class="ingredient-item">
            <input type="text" placeholder="e.g., 2 cups flour" class="ingredient-input">
            <button type="button" class="remove-ingredient">×</button>
          </div>
        `;
      }
      
      // Reset instructions container
      const instructionsContainer = document.getElementById('instructions-container');
      if (instructionsContainer) {
        instructionsContainer.innerHTML = `
          <div class="instruction-item">
            <textarea placeholder="Step 1: Describe the first step..." class="instruction-input" rows="2"></textarea>
            <button type="button" class="remove-instruction">×</button>
          </div>
        `;
      }
      
      // Reset image upload area
      const uploadArea = document.getElementById('image-upload-area');
      const preview = document.getElementById('recipe-image-preview');
      const placeholder = uploadArea.querySelector('.image-upload-placeholder');
      if (preview) { preview.style.display = 'none'; preview.src = ''; }
      if (placeholder) { placeholder.style.display = ''; }
      delete uploadArea.dataset.imageUrl;
      
      // Reset submit button text
      const submitBtn = document.querySelector('#recipe-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Save Recipe';
      }
    }
  }
}

function showAuthModal(isSignUp = false) {
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit');
  const switchText = document.getElementById('auth-switch-text');
  const usernameGroup = document.getElementById('username-group');
  const nameGroup = document.getElementById('name-group');
  const usernameInput = document.getElementById('auth-username');
  const nameInput = document.getElementById('auth-name');

  if (isSignUp) {
    title.textContent = 'Sign Up';
    submitBtn.textContent = 'Sign Up';
    switchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Login</a>';
    usernameGroup.style.display = 'block';
    nameGroup.style.display = 'block';
    usernameInput.required = true;
    nameInput.required = false;
  } else {
    title.textContent = 'Login';
    submitBtn.textContent = 'Login';
    switchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Sign up</a>';
    usernameGroup.style.display = 'none';
    nameGroup.style.display = 'none';
    usernameInput.required = false;
    nameInput.required = false;
  }

  authModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (show) {
    loading.classList.remove('hidden');
  } else {
    loading.classList.add('hidden');
  }
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10000;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);

  // Auto remove
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Event listeners
function setupEventListeners() {
  // Logo click for home navigation
  const logoLink = document.getElementById('logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      showPage('home');
    });
  }

  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      showPage(page);
    });
  });

  // Avatar dropdown
  const avatarBtn = document.getElementById('avatar-btn');
  if (avatarBtn) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAvatarDropdown();
    });
  }

  // Notification dropdown
  const notificationBtn = document.getElementById('notification-btn');
  if (notificationBtn) {
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationDropdown();
    });
  }

  // Dropdown navigation items
  document.querySelectorAll('.dropdown-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      showPage(page);
      document.querySelector('.dropdown-menu')?.classList.remove('show');
    });
  });

  // Auth buttons
  document.getElementById('login-btn').addEventListener('click', () => {
    showAuthModal(false);
  });

  document.getElementById('signup-btn').addEventListener('click', () => {
    showAuthModal(true);
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    signOut();
  });

  // Auth modal
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const isSignUp = document.getElementById('auth-modal-title').textContent === 'Sign Up';

    try {
      if (isSignUp) {
        const username = document.getElementById('auth-username').value;
        const name = document.getElementById('auth-name').value;
        await signUp(email, password, username, name);
        showNotification('Account created successfully!', 'success');
      } else {
        await signIn(email, password);
        showNotification('Logged in successfully!', 'success');
      }
      authModal.classList.remove('active');
      document.body.style.overflow = '';
      document.getElementById('auth-form').reset();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });

  // Auth switch
  document.addEventListener('click', (e) => {
    if (e.target.id === 'auth-switch-link') {
      e.preventDefault();
      const isCurrentlySignUp = document.getElementById('auth-modal-title').textContent === 'Sign Up';
      showAuthModal(!isCurrentlySignUp);
    }
  });

  // Search
  document.getElementById('search-btn').addEventListener('click', () => {
    performSearch();
  });

  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  document.getElementById('cuisine-filter').addEventListener('change', performSearch);
  document.getElementById('difficulty-filter').addEventListener('change', performSearch);

  // Recipe form
  setupRecipeForm();

  // Modal close
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      authModal.classList.remove('active');
      recipeModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // Modal backdrop close
  [authModal, recipeModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
}

function performSearch() {
  const searchTerm = document.getElementById('search-input').value;
  const cuisine = document.getElementById('cuisine-filter').value;
  const difficulty = document.getElementById('difficulty-filter').value;
  
  loadRecipes(searchTerm, cuisine, difficulty, false);
}

// Infinite scroll handler
function setupInfiniteScroll() {
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (currentPage !== 'home') return;
      if (isLoadingMore || !hasMoreRecipes) return;
      
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const clientHeight = window.innerHeight;
      
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        const searchTerm = document.getElementById('search-input')?.value || '';
        const cuisine = document.getElementById('cuisine-filter')?.value || '';
        const difficulty = document.getElementById('difficulty-filter')?.value || '';
        loadRecipes(searchTerm, cuisine, difficulty, true);
      }
    }, 200);
  });
}

function setupRecipeForm() {
  const form = document.getElementById('recipe-form');
  const addIngredientBtn = document.getElementById('add-ingredient');
  const addInstructionBtn = document.getElementById('add-instruction');
  const ingredientsContainer = document.getElementById('ingredients-container');
  const instructionsContainer = document.getElementById('instructions-container');

  // Image upload area
  const uploadArea = document.getElementById('image-upload-area');
  const fileInput = document.getElementById('recipe-image-input');
  const preview = document.getElementById('recipe-image-preview');
  const placeholder = uploadArea.querySelector('.image-upload-placeholder');

  uploadArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        delete uploadArea.dataset.imageUrl;
      };
      reader.readAsDataURL(fileInput.files[0]);
    }
  });

  // Add ingredient
  addIngredientBtn.addEventListener('click', () => {
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    ingredientItem.innerHTML = `
      <input type="text" placeholder="e.g., 2 cups flour" class="ingredient-input">
      <button type="button" class="remove-ingredient">×</button>
    `;
    ingredientsContainer.appendChild(ingredientItem);

    ingredientItem.querySelector('.remove-ingredient').addEventListener('click', () => {
      ingredientItem.remove();
    });
  });

  // Add instruction
  addInstructionBtn.addEventListener('click', () => {
    const instructionItem = document.createElement('div');
    instructionItem.className = 'instruction-item';
    const stepNumber = instructionsContainer.children.length + 1;
    instructionItem.innerHTML = `
      <textarea placeholder="Step ${stepNumber}: Describe this step..." class="instruction-input" rows="2"></textarea>
      <button type="button" class="remove-instruction">×</button>
    `;
    instructionsContainer.appendChild(instructionItem);

    instructionItem.querySelector('.remove-instruction').addEventListener('click', () => {
      instructionItem.remove();
      updateInstructionPlaceholders();
    });
  });

  // Remove ingredient/instruction handlers for initial items
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-ingredient')) {
      e.target.parentElement.remove();
    }
    if (e.target.classList.contains('remove-instruction')) {
      e.target.parentElement.remove();
      updateInstructionPlaceholders();
    }
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      showAuthModal();
      return;
    }

    const ingredients = [];
    const instructions = [];

    // Collect ingredients
    document.querySelectorAll('.ingredient-input').forEach(input => {
      if (input.value.trim()) {
        ingredients.push(input.value.trim());
      }
    });

    // Collect instructions
    document.querySelectorAll('.instruction-input').forEach(input => {
      if (input.value.trim()) {
        instructions.push(input.value.trim());
      }
    });

    if (ingredients.length === 0) {
      showNotification('Please add at least one ingredient', 'error');
      return;
    }

    if (instructions.length === 0) {
      showNotification('Please add at least one instruction', 'error');
      return;
    }

    let imageUrl = '';
    const uploadArea = document.getElementById('image-upload-area');
    const fileInput = document.getElementById('recipe-image-input');

    if (fileInput.files && fileInput.files.length > 0) {
      // Upload new image
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const uploadRes = await fetch(`${API_BASE}/recipes/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });
      if (!uploadRes.ok) {
        showNotification('Failed to upload image', 'error');
        return;
      }
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.image_url;
    } else if (uploadArea.dataset.imageUrl) {
      imageUrl = uploadArea.dataset.imageUrl;
    }

    const recipeData = {
      title: document.getElementById('recipe-title').value,
      description: document.getElementById('recipe-description').value,
      cuisine: document.getElementById('recipe-cuisine').value,
      difficulty: document.getElementById('recipe-difficulty').value,
      prep_time: parseInt(document.getElementById('recipe-prep-time').value) || 0,
      cook_time: parseInt(document.getElementById('recipe-cook-time').value) || 0,
      servings: parseInt(document.getElementById('recipe-servings').value) || 1,
      image_url: imageUrl || null,
      ingredients,
      instructions
    };

    try {
      // Check if we're editing an existing recipe
      const recipeId = form.dataset.recipeId;
      
      if (recipeId) {
        // Update existing recipe
        await updateRecipe(recipeId, recipeData);
        delete form.dataset.recipeId; // Clear the recipe ID
      } else {
        // Create new recipe
        await createRecipe(recipeData);
      }
      
      form.reset();
      // Reset dynamic fields
      ingredientsContainer.innerHTML = `
        <div class="ingredient-item">
          <input type="text" placeholder="e.g., 2 cups flour" class="ingredient-input">
          <button type="button" class="remove-ingredient">×</button>
        </div>
      `;
      instructionsContainer.innerHTML = `
        <div class="instruction-item">
          <textarea placeholder="Step 1: Describe the first step..." class="instruction-input" rows="2"></textarea>
          <button type="button" class="remove-instruction">×</button>
        </div>
      `;
      
      // Reset image upload area
      const preview = document.getElementById('recipe-image-preview');
      const placeholder = uploadArea.querySelector('.image-upload-placeholder');
      if (preview) { preview.style.display = 'none'; preview.src = ''; }
      if (placeholder) { placeholder.style.display = ''; }
      delete uploadArea.dataset.imageUrl;
      fileInput.value = '';
      
      // Reset submit button text
      const submitBtn = document.querySelector('#recipe-form button[type=\"submit\"]');
      if (submitBtn) {
        submitBtn.textContent = 'Create Recipe';
      }
    } catch (error) {
      // Error already handled in createRecipe/updateRecipe function
    }
  });

  // Cancel button
  document.getElementById('cancel-recipe').addEventListener('click', () => {
    form.reset();
    showPage('home');
  });
}

function updateInstructionPlaceholders() {
  document.querySelectorAll('.instruction-input').forEach((input, index) => {
    input.placeholder = `Step ${index + 1}: Describe this step...`;
  });
}

function addIngredient(value = '') {
  const ingredientsContainer = document.getElementById('ingredients-container');
  const ingredientItem = document.createElement('div');
  ingredientItem.className = 'ingredient-item';
  ingredientItem.innerHTML = `
    <input type="text" placeholder="e.g., 2 cups flour" class="ingredient-input" value="${escapeHtml(value)}">
    <button type="button" class="remove-ingredient">×</button>
  `;
  ingredientsContainer.appendChild(ingredientItem);

  ingredientItem.querySelector('.remove-ingredient').addEventListener('click', () => {
    ingredientItem.remove();
  });
}

function addInstruction(value = '') {
  const instructionsContainer = document.getElementById('instructions-container');
  const instructionItem = document.createElement('div');
  instructionItem.className = 'instruction-item';
  const stepNumber = instructionsContainer.children.length + 1;
  instructionItem.innerHTML = `
    <textarea placeholder="Step ${stepNumber}: Describe this step..." class="instruction-input" rows="2">${escapeHtml(value)}</textarea>
    <button type="button" class="remove-instruction">×</button>
  `;
  instructionsContainer.appendChild(instructionItem);

  instructionItem.querySelector('.remove-instruction').addEventListener('click', () => {
    instructionItem.remove();
    updateInstructionPlaceholders();
  });
}

// Make functions available globally
window.showRecipeDetail = showRecipeDetail;
window.toggleFavorite = toggleFavorite;
window.editRecipe = editRecipe;
window.deleteRecipe = deleteRecipe;
window.confirmDeleteRecipe = confirmDeleteRecipe;
window.deleteRecipeFromDetail = deleteRecipeFromDetail;
window.closeRecipeModal = closeRecipeModal;

// Profile Management Functions
async function loadUserProfile() {
  if (!currentUser) {
    showAuthModal();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      // If profile endpoint fails, use basic user info
      console.warn('Profile endpoint failed, using basic user info');
      loadBasicProfile();
      return;
    }

    const profile = await response.json();
    
    // Update profile display
    document.getElementById('profile-user-name').textContent = profile.name || profile.username || profile.email;
    document.getElementById('profile-user-email').textContent = profile.email;
    
    // Update avatar
    const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || profile.username || profile.email)}&background=f97316&color=fff&size=150`;
    document.getElementById('profile-avatar-img').src = avatarUrl;
    
    // Update form fields
    document.getElementById('profile-username').value = profile.username || '';
    document.getElementById('profile-name').value = profile.name || '';
    document.getElementById('profile-email-input').value = profile.email || '';
    document.getElementById('profile-bio').value = profile.bio || '';
    
    // Load dietary preferences with safe JSON parsing
    try {
      if (profile.dietary_restrictions) {
        const dietary = typeof profile.dietary_restrictions === 'string' 
          ? JSON.parse(profile.dietary_restrictions) 
          : profile.dietary_restrictions;
        if (Array.isArray(dietary)) {
          dietary.forEach(item => {
            const checkbox = document.querySelector(`input[name="dietary"][value="${item}"]`);
            if (checkbox) checkbox.checked = true;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse dietary restrictions:', e);
    }
    
    try {
      if (profile.allergies) {
        const allergies = typeof profile.allergies === 'string'
          ? JSON.parse(profile.allergies)
          : profile.allergies;
        if (Array.isArray(allergies)) {
          allergies.forEach(item => {
            const checkbox = document.querySelector(`input[name="allergies"][value="${item}"]`);
            if (checkbox) checkbox.checked = true;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse allergies:', e);
    }
    
    // Load preferred cuisines
    try {
      if (profile.preferred_cuisines) {
        const cuisines = typeof profile.preferred_cuisines === 'string'
          ? JSON.parse(profile.preferred_cuisines)
          : profile.preferred_cuisines;
        if (Array.isArray(cuisines)) {
          const cuisineList = document.getElementById('cuisine-list');
          cuisineList.innerHTML = '';
          cuisines.forEach(cuisine => {
            addCuisineTag(cuisine);
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse preferred cuisines:', e);
    }
    
    // Load statistics
    await loadUserStatistics();
  } catch (error) {
    console.error('Error loading profile:', error);
    // Load basic profile as fallback
    loadBasicProfile();
  }
}

function loadBasicProfile() {
  if (!currentUser) return;
  
  // Use basic user info from currentUser
  document.getElementById('profile-user-name').textContent = currentUser.name || currentUser.username || currentUser.email;
  document.getElementById('profile-user-email').textContent = currentUser.email;
  
  // Set default avatar
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || currentUser.username || currentUser.email)}&background=f97316&color=fff&size=150`;
  document.getElementById('profile-avatar-img').src = avatarUrl;
  
  // Set form fields
  document.getElementById('profile-username').value = currentUser.username || '';
  document.getElementById('profile-name').value = currentUser.name || '';
  document.getElementById('profile-email-input').value = currentUser.email || '';
  
  // Load basic statistics
  loadUserStatistics();
}

async function loadUserStatistics() {
  if (!currentUser) return;

  try {
    const response = await fetch(`${API_BASE}/auth/statistics`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const stats = await response.json();
      document.getElementById('stat-recipes').textContent = stats.recipes || 0;
      document.getElementById('stat-favorites').textContent = stats.favorites || 0;
      document.getElementById('stat-likes').textContent = stats.likes || 0;
    }
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

async function updateProfile(profileData) {
  try {
    const response = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(profileData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update profile');
    }

    const data = await response.json();
    
    // Update current user
    currentUser = { ...currentUser, ...data.user };
    document.getElementById('user-name-dropdown').textContent = data.user.email;
    
    showNotification('Profile updated successfully!', 'success');
    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

async function changePassword(currentPassword, newPassword) {
  try {
    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }

    showNotification('Password changed successfully!', 'success');
  } catch (error) {
    console.error('Error changing password:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

async function updatePreferences(preferences) {
  try {
    console.log('Sending preferences:', preferences);
    
    const response = await fetch(`${API_BASE}/auth/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(preferences)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Server response error:', error);
      
      // Show specific message for migration issues
      if (error.code === 'MIGRATION_REQUIRED') {
        throw new Error('Database needs to be updated. Please run the migration script in server/migrations/add_profile_fields.sql');
      }
      
      throw new Error(error.error || 'Failed to update preferences');
    }

    showNotification('Preferences saved successfully!', 'success');
  } catch (error) {
    console.error('Error updating preferences:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

async function uploadAvatar(file) {
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_BASE}/auth/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload avatar');
    }

    const data = await response.json();
    
    // Update avatar display
    document.getElementById('profile-avatar-img').src = data.avatar_url;
    
    showNotification('Avatar updated successfully!', 'success');
  } catch (error) {
    console.error('Error uploading avatar:', error);
    showNotification(error.message, 'error');
  }
}

function setupProfilePage() {
  // Tab switching
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');
    });
  });

  // Profile form submission
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const profileData = {
      username: document.getElementById('profile-username').value,
      name: document.getElementById('profile-name').value,
      email: document.getElementById('profile-email-input').value,
      bio: document.getElementById('profile-bio').value
    };

    await updateProfile(profileData);
  });

  // Password form submission
  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showNotification('Password must be at least 8 characters', 'error');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      document.getElementById('password-form').reset();
    } catch (error) {
      // Error already handled
    }
  });

  // Preferences form submission
  document.getElementById('preferences-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dietary = Array.from(document.querySelectorAll('input[name="dietary"]:checked'))
      .map(cb => cb.value);
    
    const allergies = Array.from(document.querySelectorAll('input[name="allergies"]:checked'))
      .map(cb => cb.value);
    
    // Get cuisines from tags
    const cuisines = Array.from(document.querySelectorAll('#cuisine-list .cuisine-tag'))
      .map(tag => tag.dataset.cuisine);

    const preferences = {
      dietary_restrictions: JSON.stringify(dietary),
      allergies: JSON.stringify(allergies),
      preferred_cuisines: JSON.stringify(cuisines)
    };

    await updatePreferences(preferences);
  });

  // Add cuisine functionality
  document.getElementById('add-cuisine-btn').addEventListener('click', () => {
    const select = document.getElementById('cuisine-select');
    const selectedValue = select.value;
    const selectedText = select.options[select.selectedIndex].text;
    
    if (!selectedValue) {
      showNotification('Please select a cuisine', 'error');
      return;
    }
    
    // Check if already added
    const existingTags = document.querySelectorAll('#cuisine-list .cuisine-tag');
    const alreadyExists = Array.from(existingTags).some(tag => tag.dataset.cuisine === selectedValue);
    
    if (alreadyExists) {
      showNotification('Cuisine already added', 'error');
      return;
    }
    
    addCuisineTag(selectedValue, selectedText);
    select.value = '';
  });

  // Avatar upload
  document.getElementById('change-avatar-btn').addEventListener('click', () => {
    document.getElementById('avatar-upload').click();
  });

  document.getElementById('avatar-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showNotification('Please select an image file', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('Image must be less than 5MB', 'error');
      return;
    }

    await uploadAvatar(file);
  });
}

function addCuisineTag(cuisineValue, cuisineLabel) {
  const cuisineList = document.getElementById('cuisine-list');
  
  // If cuisineLabel not provided, get it from the select options
  if (!cuisineLabel) {
    const select = document.getElementById('cuisine-select');
    const option = Array.from(select.options).find(opt => opt.value === cuisineValue);
    cuisineLabel = option ? option.text : cuisineValue;
  }
  
  const tag = document.createElement('div');
  tag.className = 'cuisine-tag';
  tag.dataset.cuisine = cuisineValue;
  tag.innerHTML = `
    <span>${escapeHtml(cuisineLabel)}</span>
    <button type="button" onclick="removeCuisineTag(this)" title="Remove">&times;</button>
  `;
  
  cuisineList.appendChild(tag);
}

function removeCuisineTag(button) {
  button.closest('.cuisine-tag').remove();
}

// Make cuisine functions globally available
window.removeCuisineTag = removeCuisineTag;

// ========== User Follow Functions ==========

// Setup follow button
async function setupFollowButton(userId) {
  const followBtn = document.getElementById('follow-user-btn');
  if (!followBtn) {
    console.error('Follow button not found');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const isFollowing = data.user.isFollowing;
      
      followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
      if (isFollowing) {
        followBtn.classList.add('following');
      } else {
        followBtn.classList.remove('following');
      }
      
      // Remove old event listener and add new one
      followBtn.onclick = async (e) => {
        e.preventDefault();
        await toggleFollow(userId);
      };
    }
  } catch (error) {
    console.error('Error checking follow status:', error);
  }
}

// Toggle follow/unfollow
async function toggleFollow(userId) {
  if (!currentUser) {
    showNotification('Please log in to follow users', 'error');
    return;
  }

  const followBtn = document.getElementById('follow-user-btn');
  if (!followBtn) {
    console.error('Follow button not found');
    return;
  }

  const isFollowing = followBtn.classList.contains('following');

  try {
    const response = await fetch(`${API_BASE}/users/${userId}/follow`, {
      method: isFollowing ? 'DELETE' : 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      followBtn.textContent = isFollowing ? 'Follow' : 'Unfollow';
      if (isFollowing) {
        followBtn.classList.remove('following');
      } else {
        followBtn.classList.add('following');
      }
      showNotification(isFollowing ? 'Unfollowed successfully' : 'Followed successfully', 'success');
      
      // Update follower count in profile modal if it exists
      updateFollowerCount(isFollowing ? -1 : 1);
    } else {
      const data = await response.json();
      showNotification(data.error || 'Failed to update follow status', 'error');
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    showNotification('Failed to update follow status', 'error');
  }
}

// Show user profile modal
async function showUserProfile(userId) {
  if (!userId) return;

  try {
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Fetch user profile
    const profileResponse = await fetch(`${API_BASE}/users/${userId}`, { headers });
    if (!profileResponse.ok) throw new Error('Failed to fetch user profile');
    const profileData = await profileResponse.json();
    const user = profileData.user;

    // Fetch user's recipes
    const recipesResponse = await fetch(`${API_BASE}/users/${userId}/recipes`, { headers });
    if (!recipesResponse.ok) throw new Error('Failed to fetch user recipes');
    const userRecipes = await recipesResponse.json();

    // Create modal HTML
    const isOwnProfile = currentUser && currentUser.id === parseInt(userId);
    const safeUsername = escapeHtml(user.username || '');
    const safeName = escapeHtml(user.name || '');
    const safeBio = escapeHtml(user.bio || '');
    const safeAvatarUrl = escapeHtml(user.avatar_url || '');
    const avatarInitial = escapeHtml((user.username || 'U').charAt(0).toUpperCase());
    
    const modalHTML = `
      <div class="modal active" id="user-profile-modal">
        <div class="modal-content large">
          <span class="close-modal" onclick="closeUserProfileModal()">&times;</span>
          <div class="user-profile-container">
            <div class="user-profile-header">
              <div class="user-avatar-large">
                ${safeAvatarUrl ? 
                  `<img src="${safeAvatarUrl}" alt="${safeUsername}">` : 
                  `<div class="avatar-placeholder">${avatarInitial}</div>`
                }
              </div>
              <div class="user-profile-info">
                <h2>@${safeUsername}</h2>
                ${safeName ? `<p class="user-full-name">${safeName}</p>` : ''}
                ${safeBio ? `<p class="user-bio">${safeBio}</p>` : ''}
                <div class="user-stats">
                  <div class="stat">
                    <strong>${user.recipeCount || 0}</strong>
                    <span>Recipes</span>
                  </div>
                  <div class="stat">
                    <strong>${user.followerCount || 0}</strong>
                    <span>Followers</span>
                  </div>
                  <div class="stat">
                    <strong>${user.followingCount || 0}</strong>
                    <span>Following</span>
                  </div>
                </div>
                ${!isOwnProfile && currentUser ? `
                  <button class="btn btn-primary${user.isFollowing ? ' following' : ''}" id="profile-follow-btn" onclick="toggleFollowFromProfile(${userId})">
                    ${user.isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="user-recipes-section">
              <h3>${isOwnProfile ? 'Your' : safeUsername + "'s"} Recipes</h3>
              <div class="recipes-grid" id="user-profile-recipes-grid">
                ${userRecipes.length === 0 ? 
                  '<p class="text-muted">No recipes yet.</p>' :
                  userRecipes.map(recipe => {
                    const rTitle = escapeHtml(recipe.title);
                    const rDesc = escapeHtml(recipe.description || '');
                    const rImage = escapeHtml(recipe.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg');
                    return `
                    <div class="recipe-card" onclick="closeUserProfileModal(); showRecipeDetail(${recipe.id})">
                      <img 
                        src="${rImage}" 
                        alt="${rTitle}"
                        class="recipe-image"
                        onerror="this.src='https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'"
                      >
                      <div class="recipe-content">
                        <h3 class="recipe-title">${rTitle}</h3>
                        <p class="recipe-description">${rDesc}</p>
                        <div class="recipe-meta">
                          <span>⏱️ ${(recipe.prep_time || 0) + (recipe.cook_time || 0)} min</span>
                          <span>🍽️ ${recipe.servings || 1} servings</span>
                        </div>
                      </div>
                    </div>
                  `;}).join('')
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('user-profile-modal');
    if (existingModal) existingModal.remove();

    // Insert modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';

  } catch (error) {
    console.error('Error loading user profile:', error);
    showNotification('Failed to load user profile', 'error');
  }
}

// Toggle follow from profile modal
async function toggleFollowFromProfile(userId) {
  if (!currentUser) {
    showNotification('Please log in to follow users', 'error');
    return;
  }

  const followBtn = document.getElementById('profile-follow-btn');
  if (!followBtn) {
    console.error('Profile follow button not found');
    return;
  }
  
  const isFollowing = followBtn.textContent.trim() === 'Unfollow';

  try {
    const response = await fetch(`${API_BASE}/users/${userId}/follow`, {
      method: isFollowing ? 'DELETE' : 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      followBtn.textContent = isFollowing ? 'Follow' : 'Unfollow';
      if (isFollowing) {
        followBtn.classList.remove('following');
      } else {
        followBtn.classList.add('following');
      }
      showNotification(isFollowing ? 'Unfollowed successfully' : 'Followed successfully', 'success');
      
      // Update follower count in profile modal
      updateFollowerCount(isFollowing ? -1 : 1);
    } else {
      const data = await response.json();
      showNotification(data.error || 'Failed to update follow status', 'error');
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    showNotification('Failed to update follow status', 'error');
  }
}

// Close user profile modal
function closeUserProfileModal() {
  const modal = document.getElementById('user-profile-modal');
  if (modal) modal.remove();
  document.body.style.overflow = '';
}

// Update follower count in UI
function updateFollowerCount(change) {
  // Find follower count in user profile modal
  const userStatsDiv = document.querySelector('#user-profile-modal .user-stats');
  if (userStatsDiv) {
    const followerStat = userStatsDiv.children[1]; // Second stat is followers
    if (followerStat) {
      const countElement = followerStat.querySelector('strong');
      if (countElement) {
        const currentCount = parseInt(countElement.textContent) || 0;
        const newCount = Math.max(0, currentCount + change);
        countElement.textContent = newCount;
      }
    }
  }
}

// Make functions globally available
window.showUserProfile = showUserProfile;
window.toggleFollow = toggleFollow;
window.toggleFollowFromProfile = toggleFollowFromProfile;
window.closeUserProfileModal = closeUserProfileModal;

// Notification functions
let notificationPollingInterval = null;

function toggleNotificationDropdown() {
  const dropdown = document.querySelector('.notification-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
    if (dropdown.classList.contains('show')) {
      loadNotifications();
    }
  }
}

async function loadNotifications() {
  if (!currentUser) return;

  try {
    console.log('Fetching notifications...');
    const response = await fetch(`${API_BASE}/notifications`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Notifications loaded:', data);
      displayNotifications(data.notifications);
      updateNotificationBadge(data.unreadCount);
    } else {
      console.error('Failed to load notifications:', response.status);
    }
  } catch (error) {
    console.error('Failed to load notifications:', error);
  }
}

function displayNotifications(notifications) {
  const notificationList = document.getElementById('notification-list');
  if (!notificationList) return;

  if (notifications.length === 0) {
    notificationList.innerHTML = `
      <div class="notification-empty">
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }

  notificationList.innerHTML = notifications.map(notification => {
    const timeAgo = formatTimeAgo(new Date(notification.created_at));
    const unreadClass = notification.is_read ? '' : 'unread';
    const safeActor = escapeHtml(notification.actor_username || '');
    const safeRecipeTitle = notification.recipe_title ? escapeHtml(notification.recipe_title) : '';
    
    let message = '';
    switch (notification.type) {
      case 'comment_on_recipe':
        message = `<span class="notification-actor">@${safeActor}</span> commented on your recipe`;
        break;
      case 'reply_to_comment':
        message = `<span class="notification-actor">@${safeActor}</span> replied to your comment`;
        break;
      case 'new_recipe_from_followed':
        message = `<span class="notification-actor">@${safeActor}</span> posted a new recipe`;
        break;
    }

    return `
      <div class="notification-item ${unreadClass}" onclick="handleNotificationClick(${notification.id}, ${notification.recipe_id})">
        <div class="notification-content">
          <div class="notification-action">${message}</div>
          ${safeRecipeTitle ? `<div class="notification-recipe">"${safeRecipeTitle}"</div>` : ''}
          <div class="notification-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
}

async function handleNotificationClick(notificationId, recipeId) {
  // Mark as read
  try {
    await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }

  // Close dropdown
  const dropdown = document.querySelector('.notification-dropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }

  // Navigate to recipe
  if (recipeId) {
    showRecipeDetail(recipeId);
  }

  // Reload notifications to update badge
  await loadNotifications();
}

async function markAllNotificationsRead() {
  if (!currentUser) return;

  try {
    const response = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      await loadNotifications();
    }
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
  }
}

function startNotificationPolling() {
  // Poll every 30 seconds
  notificationPollingInterval = setInterval(() => {
    if (currentUser) {
      loadNotifications();
    }
  }, 30000);
}

function stopNotificationPolling() {
  if (notificationPollingInterval) {
    clearInterval(notificationPollingInterval);
    notificationPollingInterval = null;
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
}

// Make notification functions globally available
window.toggleNotificationDropdown = toggleNotificationDropdown;
window.handleNotificationClick = handleNotificationClick;
window.markAllNotificationsRead = markAllNotificationsRead;

