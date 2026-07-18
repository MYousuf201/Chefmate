class AppNotification {
  final int id;
  final int userId;
  final String type;
  final int actorId;
  final String? actorUsername;
  final String? actorName;
  final String? actorAvatar;
  final int recipeId;
  final String? recipeTitle;
  final int? commentId;
  final bool isRead;
  final String? createdAt;

  AppNotification({
    required this.id,
    required this.userId,
    required this.type,
    required this.actorId,
    this.actorUsername,
    this.actorName,
    this.actorAvatar,
    required this.recipeId,
    this.recipeTitle,
    this.commentId,
    this.isRead = false,
    this.createdAt,
  });

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: _toInt(json['id']),
      userId: _toInt(json['user_id']),
      type: json['type']?.toString() ?? '',
      actorId: _toInt(json['actor_id']),
      actorUsername: json['actor_username']?.toString(),
      actorName: json['actor_name']?.toString(),
      actorAvatar: json['actor_avatar']?.toString(),
      recipeId: _toInt(json['recipe_id']),
      recipeTitle: json['recipe_title']?.toString(),
      commentId: json['comment_id'] != null ? _toInt(json['comment_id']) : null,
      isRead: json['is_read'] is bool ? json['is_read'] : json['is_read'] == 1,
      createdAt: json['created_at']?.toString(),
    );
  }

  String get message {
    switch (type) {
      case 'comment_on_recipe':
        return '${actorName ?? actorUsername ?? 'Someone'} commented on your recipe';
      case 'reply_to_comment':
        return '${actorName ?? actorUsername ?? 'Someone'} replied to your comment';
      case 'new_recipe_from_followed':
        return '${actorName ?? actorUsername ?? 'Someone'} posted a new recipe';
      default:
        return 'New notification';
    }
  }
}
