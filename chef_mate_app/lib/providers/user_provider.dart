import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/user_service.dart';

class UserProvider with ChangeNotifier {
  final UserService _userService = UserService();

  User? _viewedUser;
  List<User> _followers = [];
  List<User> _following = [];
  bool _isLoading = false;
  String? _error;

  User? get viewedUser => _viewedUser;
  List<User> get followers => _followers;
  List<User> get following => _following;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadUser(int userId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _viewedUser = await _userService.getUser(userId);
    } catch (e) {
      _error = 'Failed to load user profile';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> toggleFollow(int userId) async {
    try {
      if (_viewedUser?.isFollowing == true) {
        await _userService.unfollowUser(userId);
        _viewedUser?.isFollowing = false;
      } else {
        await _userService.followUser(userId);
        _viewedUser?.isFollowing = true;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to update follow status';
      notifyListeners();
      return false;
    }
  }

  Future<void> loadFollowers(int userId) async {
    try {
      _followers = await _userService.getFollowers(userId);
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load followers';
      notifyListeners();
    }
  }

  Future<void> loadFollowing(int userId) async {
    try {
      _following = await _userService.getFollowing(userId);
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load following';
      notifyListeners();
    }
  }

  void clear() {
    _viewedUser = null;
    _followers = [];
    _following = [];
    _error = null;
  }
}
