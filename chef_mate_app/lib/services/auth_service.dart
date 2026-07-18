import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api = ApiService();

  Future<User> login(String email, String password, {bool rememberMe = true}) async {
    final data = await _api.post('/auth/login', body: {
      'email': email,
      'password': password,
    });
    await _api.saveToken(data['token'], rememberMe: rememberMe);
    return User.fromJson(data['user']);
  }

  Future<User> register({
    required String email,
    required String password,
    required String username,
    String? name,
  }) async {
    final body = {
      'email': email,
      'password': password,
      'username': username,
      if (name != null) 'name': name,
    };
    final data = await _api.post('/auth/register', body: body);
    await _api.saveToken(data['token']);
    return User.fromJson(data['user']);
  }

  Future<User> getMe() async {
    final data = await _api.get('/auth/me');
    return User.fromJson(data['user'] ?? data);
  }

  Future<void> logout() async {
    await _api.clearToken();
  }

  Future<User> getProfile() async {
    final data = await _api.get('/auth/profile');
    return User.fromJson(data['user'] ?? data);
  }

  Future<User> updateProfile(Map<String, dynamic> updates) async {
    final data = await _api.put('/auth/profile', body: updates);
    return User.fromJson(data['user'] ?? data);
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _api.post('/auth/change-password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<void> updatePreferences(Map<String, dynamic> prefs) async {
    await _api.put('/auth/preferences', body: prefs);
  }

  Future<Map<String, dynamic>> getStatistics() async {
    return await _api.get('/auth/statistics');
  }
}
