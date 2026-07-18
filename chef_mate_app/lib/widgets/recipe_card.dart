import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/recipe.dart';
import '../config/theme.dart';
import '../config/api_config.dart';

class RecipeCard extends StatelessWidget {
  final Recipe recipe;
  final VoidCallback onTap;
  final VoidCallback? onFavoriteTap;
  final bool showFavoriteButton;

  const RecipeCard({
    super.key,
    required this.recipe,
    required this.onTap,
    this.onFavoriteTap,
    this.showFavoriteButton = true,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildImage(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    recipe.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                      color: AppTheme.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  _buildMetaRow(),
                  if (recipe.description != null && recipe.description!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      recipe.description!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.textSecondary,
                        height: 1.5,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 12),
                  _buildTags(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage() {
    final imgUrl = ApiConfig.resolveImageUrl(recipe.imageUrl);
    final placeholder = Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Center(child: Icon(Icons.restaurant, size: 48, color: Colors.white38)),
    );
    return Stack(
      children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: imgUrl != null
            ? CachedNetworkImage(
                imageUrl: imgUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => placeholder,
                errorWidget: (_, __, ___) => placeholder,
              )
            : placeholder,
        ),
        if (showFavoriteButton && onFavoriteTap != null)
          Positioned(
            top: 12,
            right: 12,
            child: GestureDetector(
              onTap: onFavoriteTap,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.9),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  recipe.isFavorited == true ? Icons.favorite : Icons.favorite_border,
                  size: 18,
                  color: recipe.isFavorited == true ? AppTheme.primaryColor : AppTheme.textSecondary,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMetaRow() {
    return Row(
      children: [
        _buildMetaItem(Icons.access_time, '${recipe.prepTime + recipe.cookTime} min'),
        const SizedBox(width: 16),
        _buildMetaItem(Icons.local_fire_department, _difficultyLabel(recipe.difficulty)),
        const SizedBox(width: 16),
        _buildMetaItem(Icons.star, recipe.averageRating != null ? recipe.averageRating!.toStringAsFixed(1) : '0.0'),
      ],
    );
  }

  String _difficultyLabel(String difficulty) {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'Easy';
      case 'medium':
        return 'Medium';
      case 'hard':
        return 'Hard';
      default:
        return difficulty;
    }
  }

  Widget _buildMetaItem(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppTheme.textSecondary),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
      ],
    );
  }

  Widget _buildTags() {
    final tags = <String>[];
    if (recipe.cuisine != null) tags.add(recipe.cuisine!);
    if (recipe.difficulty.isNotEmpty) {
      final diff = _difficultyLabel(recipe.difficulty);
      if (diff != 'Easy') tags.add(diff);
    }

    if (tags.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: tags.map((tag) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F0F0),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          tag,
          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
        ),
      )).toList(),
    );
  }
}
