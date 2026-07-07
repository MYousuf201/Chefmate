import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/recipe.dart';
import '../providers/auth_provider.dart';
import '../providers/recipe_provider.dart';
import '../widgets/comment_tile.dart';
import '../widgets/rating_widget.dart';
import '../config/theme.dart';

class RecipeDetailScreen extends StatefulWidget {
  final int recipeId;

  const RecipeDetailScreen({super.key, required this.recipeId});

  @override
  State<RecipeDetailScreen> createState() => _RecipeDetailScreenState();
}

class _RecipeDetailScreenState extends State<RecipeDetailScreen> {
  final _commentController = TextEditingController();
  int? _replyToCommentId;
  bool _showRatingSection = false;
  double _userRating = 0;
  bool _triedIt = false;
  final _reviewController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RecipeProvider>().loadRecipe(widget.recipeId);
      context.read<RecipeProvider>().loadComments(widget.recipeId);
    });
  }

  @override
  void dispose() {
    _commentController.dispose();
    _reviewController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recipe')),
      body: Consumer<RecipeProvider>(
        builder: (_, rp, __) {
          if (rp.isLoading && rp.selectedRecipe == null) {
            return const Center(child: CircularProgressIndicator());
          }
          final recipe = rp.selectedRecipe;
          if (recipe == null) {
            return const Center(child: Text('Recipe not found'));
          }
          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildImage(recipe),
                _buildHeader(recipe),
                _buildStats(recipe),
                _buildActionButtons(recipe, rp),
                _buildInfoSection('Ingredients', recipe.ingredients, isOrdered: false),
                _buildInfoSection('Instructions', recipe.instructions, isOrdered: true),
                _buildRatingSection(recipe, rp),
                _buildCommentsSection(recipe, rp),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildImage(Recipe recipe) {
    return Stack(
      children: [
          CachedNetworkImage(
            imageUrl: (recipe.imageUrl != null && recipe.imageUrl!.isNotEmpty) ? recipe.imageUrl! : 'https://placehold.co/400x300/E8E8E8/999999?text=Recipe&font=raleway',
            width: double.infinity,
            height: 220,
            fit: BoxFit.cover,
            placeholder: (_, __) => const SizedBox(height: 220),
            errorWidget: (_, __, ___) => const SizedBox(height: 220, child: Center(child: Icon(Icons.restaurant, size: 64, color: Colors.grey))),
          ),
        Positioned(
          bottom: 8,
          right: 8,
          child: Chip(
            label: Text(recipe.difficulty.toUpperCase(), style: const TextStyle(fontSize: 11, color: Colors.white)),
            backgroundColor: recipe.difficulty == 'easy'
                ? AppTheme.accentGreen
                : recipe.difficulty == 'medium'
                    ? AppTheme.accentOrange
                    : AppTheme.primaryColor,
            padding: EdgeInsets.zero,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
      ],
    );
  }

  Widget _buildHeader(Recipe recipe) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(recipe.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(
            children: [
              if (recipe.averageRating != null) ...[
                StarRatingWidget(rating: recipe.averageRating!, size: 18, showCount: true, count: recipe.ratingCount),
                const SizedBox(width: 12),
              ],
              Text('${recipe.likeCount ?? 0} likes', style: const TextStyle(color: AppTheme.textSecondary)),
            ],
          ),
          if (recipe.description != null && recipe.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(recipe.description!, style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
          ],
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => Navigator.of(context).pushNamed('/user-profile', arguments: recipe.createdBy),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundImage: recipe.creatorAvatar != null ? CachedNetworkImageProvider(recipe.creatorAvatar!) : null,
                  child: recipe.creatorAvatar == null
                      ? Text(((recipe.creatorName != null && recipe.creatorName!.isNotEmpty) ? recipe.creatorName! :
                          (recipe.creatorUsername != null && recipe.creatorUsername!.isNotEmpty) ? recipe.creatorUsername! : '?')[0].toUpperCase(), style: const TextStyle(fontSize: 12))
                      : null,
                ),
                const SizedBox(width: 8),
                Text(recipe.creatorName ?? recipe.creatorUsername ?? 'Unknown',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStats(Recipe recipe) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _statChip(Icons.access_time, '${recipe.prepTime}min prep'),
          const SizedBox(width: 8),
          _statChip(Icons.timer, '${recipe.cookTime}min cook'),
          const SizedBox(width: 8),
          _statChip(Icons.people, '${recipe.servings} servings'),
          if (recipe.cuisine != null) ...[
            const SizedBox(width: 8),
            _statChip(Icons.restaurant_menu, recipe.cuisine!),
          ],
        ],
      ),
    );
  }

  Widget _statChip(IconData icon, String label) {
    return Chip(
      avatar: Icon(icon, size: 16, color: AppTheme.primaryColor),
      label: Text(label, style: const TextStyle(fontSize: 12)),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }

  Widget _buildActionButtons(Recipe recipe, RecipeProvider rp) {
    final auth = context.watch<AuthProvider>();
    final isOwner = auth.user?.id == recipe.createdBy;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _actionBtn(
            icon: recipe.userLikeType == 'like' ? Icons.thumb_up : Icons.thumb_up_outlined,
            label: '${recipe.likeCount ?? 0}',
            active: recipe.userLikeType == 'like',
            onTap: () {
              if (recipe.userLikeType == 'like') {
                rp.unlikeRecipe(recipe.id);
              } else {
                rp.likeRecipe(recipe.id, 'like');
              }
            },
          ),
          const SizedBox(width: 8),
          _actionBtn(
            icon: recipe.userLikeType == 'dislike' ? Icons.thumb_down : Icons.thumb_down_outlined,
            label: '${recipe.dislikeCount ?? 0}',
            active: recipe.userLikeType == 'dislike',
            onTap: () {
              if (recipe.userLikeType == 'dislike') {
                rp.unlikeRecipe(recipe.id);
              } else {
                rp.likeRecipe(recipe.id, 'dislike');
              }
            },
          ),
          const SizedBox(width: 8),
          _actionBtn(
            icon: recipe.isFavorited == true ? Icons.favorite : Icons.favorite_border,
            label: '${recipe.favoriteCount ?? 0}',
            active: recipe.isFavorited == true,
            onTap: () {
              final userId = context.read<AuthProvider>().user?.id;
              rp.toggleFavorite(recipe.id, userId: userId);
            },
          ),
          const Spacer(),
          _actionBtn(
            icon: Icons.star_outline,
            label: 'Rate',
            active: false,
            onTap: () => setState(() => _showRatingSection = !_showRatingSection),
          ),
          if (isOwner)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => Navigator.of(context).pushNamed('/add-recipe', arguments: recipe),
            ),
          if (isOwner || auth.isModerator)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('Delete Recipe'),
                    content: const Text('Are you sure?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                      TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
                    ],
                  ),
                );
                if (confirm == true && mounted) {
                  await rp.deleteRecipe(recipe.id);
                  if (mounted) Navigator.pop(context);
                }
              },
            ),
        ],
      ),
    );
  }

  Widget _actionBtn({required IconData icon, required String label, required bool active, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: active ? AppTheme.primaryColor : Colors.grey[300]!),
          borderRadius: BorderRadius.circular(20),
          color: active ? AppTheme.primaryColor.withValues(alpha: 0.1) : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: active ? AppTheme.primaryColor : AppTheme.textSecondary),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 13, color: active ? AppTheme.primaryColor : AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoSection(String title, List<String> items, {required bool isOrdered}) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...items.asMap().entries.map((e) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isOrdered ? '${e.key + 1}.' : '\u2022', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                const SizedBox(width: 8),
                Expanded(child: Text(e.value, style: const TextStyle(fontSize: 14))),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildRatingSection(Recipe recipe, RecipeProvider rp) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              const Text('Rating & Reviews', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              IconButton(
                icon: Icon(_showRatingSection ? Icons.expand_less : Icons.expand_more),
                onPressed: () => setState(() => _showRatingSection = !_showRatingSection),
              ),
            ],
          ),
        ),
        if (_showRatingSection)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    RatingInputWidget(rating: _userRating, onRatingUpdate: (v) => _userRating = v),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _reviewController,
                      decoration: const InputDecoration(labelText: 'Review (optional)', border: OutlineInputBorder()),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Checkbox(value: _triedIt, onChanged: (v) => setState(() => _triedIt = v!)),
                        const Text('I\'ve tried this recipe'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: _userRating == 0
                          ? null
                          : () {
                              rp.rateRecipe(recipe.id, _userRating.round(), triedIt: _triedIt, review: _reviewController.text);
                              setState(() => _showRatingSection = false);
                            },
                      child: const Text('Submit Rating'),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCommentsSection(Recipe recipe, RecipeProvider rp) {
    final auth = context.watch<AuthProvider>();
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Comments (${recipe.commentCount ?? 0})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          if (_replyToCommentId != null)
            Container(
              padding: const EdgeInsets.all(8),
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(8)),
              child: Row(
                children: [
                  const Text('Replying...', style: TextStyle(color: AppTheme.accentBlue)),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => setState(() => _replyToCommentId = null),
                    child: const Icon(Icons.close, size: 18),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _commentController,
                  decoration: InputDecoration(
                    hintText: 'Add a comment...',
                    border: const OutlineInputBorder(),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.send, color: AppTheme.primaryColor),
                      onPressed: () {
                        if (_commentController.text.trim().isNotEmpty) {
                          rp.addComment(recipe.id, _commentController.text.trim(), parentCommentId: _replyToCommentId);
                          _commentController.clear();
                          _replyToCommentId = null;
                        }
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (rp.comments.isEmpty)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: Text('No comments yet')))
          else
            ...rp.comments.map((comment) => CommentTile(
              comment: comment,
              currentUserId: auth.user?.id,
              onReply: () => setState(() => _replyToCommentId = comment.id),
              onLike: () {
                if (comment.userLikeType == 'like') {
                  rp.removeCommentLike(comment.id);
                } else {
                  rp.addCommentLike(comment.id, 'like');
                }
              },
              onDislike: () {
                if (comment.userLikeType == 'dislike') {
                  rp.removeCommentLike(comment.id);
                } else {
                  rp.addCommentLike(comment.id, 'dislike');
                }
              },
              onDelete: () => rp.deleteComment(comment.id),
            )),
        ],
      ),
    );
  }
}
