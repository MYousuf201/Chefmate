import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/notification.dart';
import '../services/notification_service.dart';

class NotificationProvider with ChangeNotifier {
  final NotificationService _notificationService = NotificationService();

  List<AppNotification> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  String? _error;
  Timer? _pollTimer;

  List<AppNotification> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String? get error => _error;

  void startPolling() {
    loadNotifications();
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      loadUnreadCount();
    });
  }

  void stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> loadNotifications({int? limit}) async {
    _isLoading = true;
    notifyListeners();
    try {
      _notifications = await _notificationService.getNotifications(limit: limit);
      _unreadCount = _notifications.where((n) => !n.isRead).length;
    } catch (e) {
      _error = 'Failed to load notifications';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadUnreadCount() async {
    try {
      _unreadCount = await _notificationService.getUnreadCount();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAsRead(int id) async {
    try {
      await _notificationService.markAsRead(id);
      final index = _notifications.indexWhere((n) => n.id == id);
      if (index != -1) {
        _notifications[index] = AppNotification(
          id: _notifications[index].id,
          userId: _notifications[index].userId,
          type: _notifications[index].type,
          actorId: _notifications[index].actorId,
          actorUsername: _notifications[index].actorUsername,
          actorName: _notifications[index].actorName,
          actorAvatar: _notifications[index].actorAvatar,
          recipeId: _notifications[index].recipeId,
          recipeTitle: _notifications[index].recipeTitle,
          commentId: _notifications[index].commentId,
          isRead: true,
          createdAt: _notifications[index].createdAt,
        );
        _unreadCount = _notifications.where((n) => !n.isRead).length;
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> markAllAsRead() async {
    try {
      await _notificationService.markAllAsRead();
      for (int i = 0; i < _notifications.length; i++) {
        _notifications[i] = AppNotification(
          id: _notifications[i].id,
          userId: _notifications[i].userId,
          type: _notifications[i].type,
          actorId: _notifications[i].actorId,
          actorUsername: _notifications[i].actorUsername,
          actorName: _notifications[i].actorName,
          actorAvatar: _notifications[i].actorAvatar,
          recipeId: _notifications[i].recipeId,
          recipeTitle: _notifications[i].recipeTitle,
          commentId: _notifications[i].commentId,
          isRead: true,
          createdAt: _notifications[i].createdAt,
        );
      }
      _unreadCount = 0;
      notifyListeners();
    } catch (_) {}
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }
}
