import '../models/user.dart';
import '../models/recipe.dart';
import 'api_service.dart';

class UserService {
  final ApiService _api = ApiService();

  Future<User> getUser(int userId) async {
    final data = await _api.get('/users/$userId');
    return User.fromJson(data['user'] ?? data);
  }

  Future<List<Recipe>> getUserRecipes(int userId) async {
    final data = await _api.get('/users/$userId/recipes');
    final List<dynamic> recipes = data['recipes'] ?? ((data is List ? data : []));
    return recipes.map((r) => Recipe.fromJson(r)).toList();
  }

  Future<void> followUser(int userId) async {
    await _api.post('/users/$userId/follow');
  }

  Future<void> unfollowUser(int userId) async {
    await _api.delete('/users/$userId/follow');
  }

  Future<List<User>> getFollowers(int userId) async {
    final data = await _api.get('/users/$userId/followers');
    final List<dynamic> users = data['followers'] ?? ((data is List ? data : []));
    return users.map((u) => User.fromJson(u)).toList();
  }

  Future<List<User>> getFollowing(int userId) async {
    final data = await _api.get('/users/$userId/following');
    final List<dynamic> users = data['following'] ?? ((data is List ? data : []));
    return users.map((u) => User.fromJson(u)).toList();
  }
}
