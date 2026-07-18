class User {
  final int id;
  final String email;
  final String username;
  final String? name;
  final String? bio;
  final String? avatarUrl;
  final String role;
  final List<String>? dietaryRestrictions;
  final List<String>? allergies;
  final List<String>? preferredCuisines;
  final String? createdAt;
  final int? followerCount;
  final int? followingCount;
  final int? recipeCount;
  bool? isFollowing;

  User({
    required this.id,
    required this.email,
    required this.username,
    this.name,
    this.bio,
    this.avatarUrl,
    this.role = 'user',
    this.dietaryRestrictions,
    this.allergies,
    this.preferredCuisines,
    this.createdAt,
    this.followerCount,
    this.followingCount,
    this.recipeCount,
    this.isFollowing,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    List<String> _safeList(dynamic value) {
      if (value == null) return [];
      if (value is List) return value.map((e) => e.toString()).toList();
      return [];
    }

    int? _toIntOrNull(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is double) return value.toInt();
      return int.tryParse(value.toString());
    }

    return User(
      id: _toIntOrNull(json['id']) ?? 0,
      email: json['email']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      name: json['name']?.toString(),
      bio: json['bio']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
      role: json['role']?.toString() ?? 'user',
      dietaryRestrictions: json['dietary_restrictions'] != null ? _safeList(json['dietary_restrictions']) : null,
      allergies: json['allergies'] != null ? _safeList(json['allergies']) : null,
      preferredCuisines: json['preferred_cuisines'] != null ? _safeList(json['preferred_cuisines']) : null,
      createdAt: json['created_at']?.toString(),
      followerCount: _toIntOrNull(json['follower_count']),
      followingCount: _toIntOrNull(json['following_count']),
      recipeCount: _toIntOrNull(json['recipe_count']),
      isFollowing: json['is_following'] is bool ? json['is_following'] : (json['is_following'] == 1 ? true : json['is_following'] == 0 ? false : null),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'name': name,
      'bio': bio,
      'avatar_url': avatarUrl,
      'role': role,
      'dietary_restrictions': dietaryRestrictions,
      'allergies': allergies,
      'preferred_cuisines': preferredCuisines,
    };
  }
}
