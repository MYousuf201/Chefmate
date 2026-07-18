class Recipe {
  final int id;
  final String title;
  final String? description;
  final List<String> ingredients;
  final List<String> instructions;
  final String? cuisine;
  final int prepTime;
  final int cookTime;
  final int servings;
  final String difficulty;
  final String? imageUrl;
  final int createdBy;
  final String? creatorName;
  final String? creatorUsername;
  final String? creatorAvatar;
  final String? createdAt;
  final String? updatedAt;
  final int? likeCount;
  final int? dislikeCount;
  final int? commentCount;
  final int? favoriteCount;
  final double? averageRating;
  final int? ratingCount;
  final bool? isFavorited;
  final String? userLikeType;

  Recipe({
    required this.id,
    required this.title,
    this.description,
    this.ingredients = const [],
    this.instructions = const [],
    this.cuisine,
    this.prepTime = 0,
    this.cookTime = 0,
    this.servings = 1,
    this.difficulty = 'easy',
    this.imageUrl,
    required this.createdBy,
    this.creatorName,
    this.creatorUsername,
    this.creatorAvatar,
    this.createdAt,
    this.updatedAt,
    this.likeCount,
    this.dislikeCount,
    this.commentCount,
    this.favoriteCount,
    this.averageRating,
    this.ratingCount,
    this.isFavorited,
    this.userLikeType,
  });

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  static List<String> _safeList(dynamic value) {
    if (value == null) return [];
    if (value is List) return value.map((e) => e.toString()).toList();
    return [];
  }

  factory Recipe.fromJson(Map<String, dynamic> json) {
    return Recipe(
      id: _toInt(json['id']),
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      ingredients: _safeList(json['ingredients']),
      instructions: _safeList(json['instructions']),
      cuisine: json['cuisine']?.toString(),
      prepTime: _toInt(json['prep_time']),
      cookTime: _toInt(json['cook_time']),
      servings: _toInt(json['servings']),
      difficulty: json['difficulty']?.toString() ?? 'easy',
      imageUrl: json['image_url']?.toString(),
      createdBy: _toInt(json['created_by']),
      creatorName: json['creator_name']?.toString(),
      creatorUsername: json['creator_username']?.toString(),
      creatorAvatar: json['creator_avatar']?.toString(),
      createdAt: json['created_at']?.toString(),
      updatedAt: json['updated_at']?.toString(),
      likeCount: json['like_count'] != null ? _toInt(json['like_count']) : null,
      dislikeCount: json['dislike_count'] != null ? _toInt(json['dislike_count']) : null,
      commentCount: json['comment_count'] != null ? _toInt(json['comment_count']) : null,
      favoriteCount: json['favorite_count'] != null ? _toInt(json['favorite_count']) : null,
      averageRating: _toDouble(json['average_rating']),
      ratingCount: json['rating_count'] != null ? _toInt(json['rating_count']) : null,
      isFavorited: json['is_favorited'] is bool ? json['is_favorited'] : (json['is_favorited'] == 1 ? true : json['is_favorited'] == 0 ? false : null),
      userLikeType: json['user_like_type']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'description': description,
      'ingredients': ingredients,
      'instructions': instructions,
      'cuisine': cuisine,
      'prep_time': prepTime,
      'cook_time': cookTime,
      'servings': servings,
      'difficulty': difficulty,
      'image_url': imageUrl,
    };
  }
}
