import 'package:flutter/foundation.dart';
import '../models/recipe.dart';
import '../models/comment.dart';
import '../services/recipe_service.dart';

class RecipeProvider with ChangeNotifier {
  final RecipeService _recipeService = RecipeService();

  List<Recipe> _recipes = [];
  List<Recipe> _myRecipes = [];
  List<Recipe> _favorites = [];
  Recipe? _selectedRecipe;
  List<RecipeComment> _comments = [];
  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;
  String _searchQuery = '';
  String? _cuisineFilter;
  String? _difficultyFilter;
  int _currentPage = 1;
  bool _hasMore = true;

  List<Recipe> get recipes => _recipes;
  List<Recipe> get myRecipes => _myRecipes;
  List<Recipe> get favorites => _favorites;
  Recipe? get selectedRecipe => _selectedRecipe;
  List<RecipeComment> get comments => _comments;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  String? get error => _error;
  String get searchQuery => _searchQuery;
  String? get cuisineFilter => _cuisineFilter;
  String? get difficultyFilter => _difficultyFilter;

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void setCuisineFilter(String? cuisine) {
    _cuisineFilter = cuisine;
    notifyListeners();
  }

  void setDifficultyFilter(String? difficulty) {
    _difficultyFilter = difficulty;
    notifyListeners();
  }

  Future<void> loadRecipes({bool refresh = false}) async {
    _isLoading = true;
    _isLoadingMore = false;
    _error = null;
    _currentPage = 1;
    _hasMore = true;
    if (!refresh) _recipes = [];
    notifyListeners();
    try {
      final result = await _recipeService.getRecipes(
        search: _searchQuery.isNotEmpty ? _searchQuery : null,
        cuisine: _cuisineFilter,
        difficulty: _difficultyFilter,
        page: _currentPage,
        limit: 15,
      );
      _recipes = result['recipes'] as List<Recipe>;
      _hasMore = result['hasMore'] as bool;
    } catch (e) {
      _error = 'Failed to load recipes: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreRecipes() async {
    if (_isLoadingMore || !_hasMore) return;
    _isLoadingMore = true;
    notifyListeners();
    try {
      final nextPage = _currentPage + 1;
      final result = await _recipeService.getRecipes(
        search: _searchQuery.isNotEmpty ? _searchQuery : null,
        cuisine: _cuisineFilter,
        difficulty: _difficultyFilter,
        page: nextPage,
        limit: 15,
      );
      _currentPage = nextPage;
      final more = result['recipes'] as List<Recipe>;
      _hasMore = result['hasMore'] as bool;
      _recipes.addAll(more);
    } catch (e) {
      _error = 'Failed to load more recipes: ${e.toString()}';
    } finally {
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  Future<void> loadMyRecipes(int userId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _myRecipes = await _recipeService.getUserRecipes(userId);
    } catch (e) {
      _error = 'Failed to load your recipes: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadFavorites(int userId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _favorites = await _recipeService.getFavorites(userId);
    } catch (e) {
      _error = 'Failed to load favorites: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadRecipe(int id) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _selectedRecipe = await _recipeService.getRecipe(id);
    } catch (e) {
      _error = 'Failed to load recipe: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createRecipe(Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _recipeService.createRecipe(data);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to create recipe: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateRecipe(int id, Map<String, dynamic> data) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _selectedRecipe = await _recipeService.updateRecipe(id, data);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to update recipe: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteRecipe(int id) async {
    try {
      await _recipeService.deleteRecipe(id);
      _recipes.removeWhere((r) => r.id == id);
      _myRecipes.removeWhere((r) => r.id == id);
      _favorites.removeWhere((r) => r.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete recipe: ${e.toString()}';
      notifyListeners();
      return false;
    }
  }

  Future<bool> toggleFavorite(int recipeId, {int? userId}) async {
    try {
      final recipe = _recipes.firstWhere(
        (r) => r.id == recipeId,
        orElse: () => _favorites.firstWhere(
          (r) => r.id == recipeId,
          orElse: () {
            if (_selectedRecipe?.id == recipeId) return _selectedRecipe!;
            throw Exception('Recipe not found in any list');
          },
        ),
      );
      if (recipe.isFavorited == true) {
        await _recipeService.removeFavorite(recipeId);
      } else {
        await _recipeService.addFavorite(recipeId);
      }
      await loadRecipes();
      if (_selectedRecipe?.id == recipeId) {
        await loadRecipe(recipeId);
      }
      if (userId != null) {
        await loadFavorites(userId);
      }
      return true;
    } catch (e) {
      _error = 'Failed to update favorite';
      notifyListeners();
      return false;
    }
  }

  Future<void> loadComments(int recipeId) async {
    try {
      _comments = await _recipeService.getComments(recipeId);
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load comments';
      notifyListeners();
    }
  }

  Future<bool> addComment(int recipeId, String text, {int? parentCommentId}) async {
    try {
      await _recipeService.addComment(recipeId, text, parentCommentId: parentCommentId);
      await loadComments(recipeId);
      return true;
    } catch (e) {
      _error = 'Failed to add comment';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteComment(int commentId) async {
    try {
      await _recipeService.deleteComment(commentId);
      _comments.removeWhere((c) => c.id == commentId);
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to delete comment';
      notifyListeners();
      return false;
    }
  }

  Future<void> likeRecipe(int recipeId, String type) async {
    try {
      await _recipeService.addLike(recipeId, type);
      if (_selectedRecipe?.id == recipeId) {
        await loadRecipe(recipeId);
      }
    } catch (_) {}
  }

  Future<void> unlikeRecipe(int recipeId) async {
    try {
      await _recipeService.removeLike(recipeId);
      if (_selectedRecipe?.id == recipeId) {
        await loadRecipe(recipeId);
      }
    } catch (_) {}
  }

  Future<void> addCommentLike(int commentId, String type) async {
    try {
      await _recipeService.addCommentLike(commentId, type);
    } catch (_) {}
  }

  Future<void> removeCommentLike(int commentId) async {
    try {
      await _recipeService.removeCommentLike(commentId);
    } catch (_) {}
  }

  Future<void> rateRecipe(int recipeId, int rating, {bool triedIt = false, String? review}) async {
    try {
      await _recipeService.addRating(recipeId, rating: rating, triedIt: triedIt, review: review);
      if (_selectedRecipe?.id == recipeId) {
        await loadRecipe(recipeId);
      }
    } catch (e) {
      _error = 'Failed to submit rating';
      notifyListeners();
    }
  }

  // Smart search (image + ingredient) state
  List<String> _identifiedIngredients = [];
  List<Map<String, dynamic>> _smartResults = [];

  List<String> get identifiedIngredients => _identifiedIngredients;
  List<Map<String, dynamic>> get smartResults => _smartResults;

  Future<void> scanAndSearch(List<int> imageBytes) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _identifiedIngredients = await _recipeService.scanIngredients(imageBytes);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to scan ingredients: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> searchByIngredients(List<String> ingredients) async {
    _isLoading = true;
    _error = null;
    _identifiedIngredients = ingredients;
    notifyListeners();
    try {
      final data = await _recipeService.searchByIngredients(ingredients);
      _smartResults = (data['recipes'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (e) {
      _error = 'Failed to search: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void updateIdentifiedIngredients(List<String> ingredients) {
    _identifiedIngredients = ingredients;
    notifyListeners();
  }

  void clearSmartSearch() {
    _identifiedIngredients = [];
    _smartResults = [];
    _error = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
