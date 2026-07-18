import '../models/recipe.dart';
import '../models/comment.dart';
import 'api_service.dart';

class RecipeService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getRecipes({
    String? search,
    String? cuisine,
    String? difficulty,
    int? page,
    int? limit,
  }) async {
    final params = <String, String>{};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (cuisine != null && cuisine.isNotEmpty) params['cuisine'] = cuisine;
    if (difficulty != null && difficulty.isNotEmpty) params['difficulty'] = difficulty;
    if (page != null) params['page'] = page.toString();
    if (limit != null) params['limit'] = limit.toString();

    final data = await _api.get('/recipes', queryParams: params.isNotEmpty ? params : null);
    final List<dynamic> recipes = data['recipes'] ?? ((data is List ? data : []));
    return {
      'recipes': recipes.map((r) => Recipe.fromJson(r)).toList(),
      'hasMore': data['hasMore'] ?? false,
    };
  }

  Future<Recipe> getRecipe(int id) async {
    final data = await _api.get('/recipes/$id');
    return Recipe.fromJson(data['recipe'] ?? data);
  }

  Future<List<Recipe>> getUserRecipes(int userId) async {
    final data = await _api.get('/recipes/user/$userId');
    final items = (data is List) ? data : (data['recipes'] ?? []);
    return items.map<Recipe>((r) {
      try {
        return Recipe.fromJson(r as Map<String, dynamic>);
      } catch (e) {
        throw Exception('Recipe parse error: $e');
      }
    }).toList();
  }

  Future<List<Recipe>> getFavorites(int userId) async {
    final data = await _api.get('/recipes/favorites/$userId');
    final items = (data is List) ? data : (data['recipes'] ?? []);
    return items.map<Recipe>((r) {
      try {
        return Recipe.fromJson(r as Map<String, dynamic>);
      } catch (e) {
        throw Exception('Recipe parse error: $e');
      }
    }).toList();
  }

  Future<Recipe> createRecipe(Map<String, dynamic> recipeData) async {
    final data = await _api.post('/recipes', body: recipeData);
    return Recipe.fromJson(data['recipe'] ?? data);
  }

  Future<Recipe> updateRecipe(int id, Map<String, dynamic> recipeData) async {
    final data = await _api.put('/recipes/$id', body: recipeData);
    return Recipe.fromJson(data['recipe'] ?? data);
  }

  Future<void> deleteRecipe(int id) async {
    await _api.delete('/recipes/$id');
  }

  Future<void> addFavorite(int recipeId) async {
    await _api.post('/recipes/favorites/$recipeId');
  }

  Future<void> removeFavorite(int recipeId) async {
    await _api.delete('/recipes/favorites/$recipeId');
  }

  Future<Map<String, dynamic>> getLikes(int recipeId) async {
    return await _api.get('/recipes/$recipeId/likes');
  }

  Future<void> addLike(int recipeId, String type) async {
    await _api.post('/recipes/$recipeId/likes', body: {'likeType': type});
  }

  Future<void> removeLike(int recipeId) async {
    await _api.delete('/recipes/$recipeId/likes');
  }

  Future<Map<String, dynamic>> getRatings(int recipeId) async {
    return await _api.get('/recipes/$recipeId/ratings');
  }

  Future<void> addRating(int recipeId, {
    required int rating,
    bool triedIt = false,
    String? review,
  }) async {
    await _api.post('/recipes/$recipeId/ratings', body: {
      'rating': rating,
      'triedIt': triedIt,
      if (review != null && review.isNotEmpty) 'reviewComment': review,
    });
  }

  Future<void> deleteRating(int recipeId) async {
    await _api.delete('/recipes/$recipeId/ratings');
  }

  Future<List<RecipeComment>> getComments(int recipeId) async {
    final data = await _api.get('/recipes/$recipeId/comments');
    final List<dynamic> comments = data['comments'] ?? ((data is List ? data : []));
    return comments.map((c) => RecipeComment.fromJson(c)).toList();
  }

  Future<RecipeComment> addComment(int recipeId, String text, {int? parentCommentId}) async {
    final body = <String, dynamic>{'commentText': text};
    if (parentCommentId != null) body['parentCommentId'] = parentCommentId;
    final data = await _api.post('/recipes/$recipeId/comments', body: body);
    return RecipeComment.fromJson(data['comment'] ?? data);
  }

  Future<void> deleteComment(int commentId) async {
    await _api.delete('/recipes/comments/$commentId');
  }

  Future<void> addCommentLike(int commentId, String type) async {
    await _api.post('/recipes/comments/$commentId/likes', body: {'likeType': type});
  }

  Future<void> removeCommentLike(int commentId) async {
    await _api.delete('/recipes/comments/$commentId/likes');
  }

  Future<String> uploadImage(List<int> imageBytes, {String fileName = 'recipe.jpg'}) async {
    final data = await _api.postMultipart('/recipes/upload-image', fileField: 'image', fileBytes: imageBytes, fileName: fileName);
    return data['image_url'] as String;
  }

  Future<List<String>> scanIngredients(List<int> imageBytes) async {
    final data = await _api.postMultipart('/recipes/scan-ingredients', fileField: 'image', fileBytes: imageBytes);
    return (data['ingredients'] as List?)?.cast<String>() ?? [];
  }

  Future<Map<String, dynamic>> searchByIngredients(List<String> ingredients) async {
    return await _api.post('/recipes/by-ingredients', body: {'ingredients': ingredients});
  }

  Future<Map<String, dynamic>> getStats() async {
    return await _api.get('/stats');
  }
}
