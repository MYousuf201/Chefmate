class RecipeComment {
  final int id;
  final int recipeId;
  final int userId;
  final String? username;
  final String? userName;
  final String? userAvatar;
  final int? parentCommentId;
  final String commentText;
  final String? createdAt;
  final int? likeCount;
  final int? dislikeCount;
  final String? userLikeType;
  final List<RecipeComment>? replies;

  RecipeComment({
    required this.id,
    required this.recipeId,
    required this.userId,
    this.username,
    this.userName,
    this.userAvatar,
    this.parentCommentId,
    required this.commentText,
    this.createdAt,
    this.likeCount,
    this.dislikeCount,
    this.userLikeType,
    this.replies,
  });

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  factory RecipeComment.fromJson(Map<String, dynamic> json) {
    return RecipeComment(
      id: _toInt(json['id']),
      recipeId: _toInt(json['recipe_id']),
      userId: _toInt(json['user_id']),
      username: json['username']?.toString() ?? json['user_username']?.toString(),
      userName: json['name']?.toString() ?? json['user_name']?.toString(),
      userAvatar: json['avatar_url']?.toString(),
      parentCommentId: json['parent_comment_id'] is int
          ? json['parent_comment_id']
          : (json['parent_comment_id'] != null ? _toInt(json['parent_comment_id']) : null),
      commentText: json['comment_text']?.toString() ?? '',
      createdAt: json['created_at']?.toString(),
      likeCount: json['like_count'] != null ? _toInt(json['like_count']) : null,
      dislikeCount: json['dislike_count'] != null ? _toInt(json['dislike_count']) : null,
      userLikeType: json['user_like_type']?.toString(),
      replies: json['replies'] != null && json['replies'] is List
          ? (json['replies'] as List)
              .map((r) => RecipeComment.fromJson(r as Map<String, dynamic>))
              .toList()
          : null,
    );
  }
}
