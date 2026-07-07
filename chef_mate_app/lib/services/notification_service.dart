import '../models/notification.dart';
import 'api_service.dart';

class NotificationService {
  final ApiService _api = ApiService();

  Future<List<AppNotification>> getNotifications({
    int? limit,
    bool? unreadOnly,
  }) async {
    final params = <String, String>{};
    if (limit != null) params['limit'] = limit.toString();
    if (unreadOnly == true) params['unread_only'] = 'true';

    final data = await _api.get('/notifications',
        queryParams: params.isNotEmpty ? params : null);
    final List<dynamic> notifications =
        data['notifications'] ?? ((data is List ? data : []));
    return notifications.map((n) => AppNotification.fromJson(n)).toList();
  }

  Future<int> getUnreadCount() async {
    final data = await _api.get('/notifications/unread-count');
    return data['count'] ?? 0;
  }

  Future<void> markAsRead(int id) async {
    await _api.put('/notifications/$id/read');
  }

  Future<void> markAllAsRead() async {
    await _api.put('/notifications/read-all');
  }
}
