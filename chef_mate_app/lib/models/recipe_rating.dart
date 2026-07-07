class RecipeRating {
  final int id;
  final int userId;
  final int recipeId;
  final int rating;
  final bool triedIt;
  final String? reviewComment;
  final String? createdAt;
  final String? username;
  final String? userName;

  RecipeRating({
    required this.id,
    required this.userId,
    required this.recipeId,
    required this.rating,
    this.triedIt = false,
    this.reviewComment,
    this.createdAt,
    this.username,
    this.userName,
  });

  factory RecipeRating.fromJson(Map<String, dynamic> json) {
    return RecipeRating(
      id: json['id'] ?? 0,
      userId: json['user_id'] ?? 0,
      recipeId: json['recipe_id'] ?? 0,
      rating: json['rating'] ?? 0,
      triedIt: json['tried_it'] ?? false,
      reviewComment: json['review_comment'],
      createdAt: json['created_at'],
      username: json['username'],
      userName: json['name'],
    );
  }
}
