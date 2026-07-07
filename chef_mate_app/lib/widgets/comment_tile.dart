import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import '../models/comment.dart';
import '../config/theme.dart';

class CommentTile extends StatelessWidget {
  final RecipeComment comment;
  final bool isReply;
  final int? currentUserId;
  final VoidCallback? onReply;
  final VoidCallback? onLike;
  final VoidCallback? onDislike;
  final VoidCallback? onDelete;

  const CommentTile({
    super.key,
    required this.comment,
    this.isReply = false,
    this.currentUserId,
    this.onReply,
    this.onLike,
    this.onDislike,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: isReply ? 40 : 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            leading: CircleAvatar(
              radius: 16,
              backgroundImage: comment.userAvatar != null
                  ? CachedNetworkImageProvider(comment.userAvatar!)
                  : null,
              child: comment.userAvatar == null
                  ? Text(
                      ((comment.userName ?? comment.username ?? '?').isNotEmpty ? (comment.userName ?? comment.username ?? '?') : '?')[0].toUpperCase(),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            title: Text(
              comment.userName ?? comment.username ?? 'Unknown',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              comment.commentText,
              style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary),
            ),
            trailing: comment.createdAt != null
                ? Text(
                    _formatTime(comment.createdAt!),
                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                  )
                : null,
          ),
          Padding(
            padding: EdgeInsets.only(left: 56, right: 16),
            child: Row(
              children: [
                _actionButton(
                  icon: comment.userLikeType == 'like'
                      ? Icons.thumb_up
                      : Icons.thumb_up_outlined,
                  label: '${comment.likeCount ?? 0}',
                  color: comment.userLikeType == 'like' ? AppTheme.accentBlue : null,
                  onTap: onLike,
                ),
                const SizedBox(width: 12),
                _actionButton(
                  icon: comment.userLikeType == 'dislike'
                      ? Icons.thumb_down
                      : Icons.thumb_down_outlined,
                  label: '${comment.dislikeCount ?? 0}',
                  color: comment.userLikeType == 'dislike' ? AppTheme.primaryColor : null,
                  onTap: onDislike,
                ),
                if (!isReply) ...[
                  const SizedBox(width: 12),
                  _actionButton(
                    icon: Icons.reply_outlined,
                    label: 'Reply',
                    onTap: onReply,
                  ),
                ],
                if (comment.userId == currentUserId) ...[
                  const SizedBox(width: 12),
                  _actionButton(
                    icon: Icons.delete_outline,
                    label: '',
                    color: Colors.red,
                    onTap: onDelete,
                  ),
                ],
              ],
            ),
          ),
          if (comment.replies != null && comment.replies!.isNotEmpty)
            ...comment.replies!.map(
              (reply) => CommentTile(
                comment: reply,
                isReply: true,
                currentUserId: currentUserId,
                onReply: onReply,
                onLike: () => onLike?.call(),
                onDislike: () => onDislike?.call(),
                onDelete: () => onDelete?.call(),
              ),
            ),
          const Divider(height: 1),
        ],
      ),
    );
  }

  Widget _actionButton({
    required IconData icon,
    required String label,
    Color? color,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color ?? AppTheme.textSecondary),
          if (label.isNotEmpty) ...[
            const SizedBox(width: 3),
            Text(label, style: TextStyle(fontSize: 12, color: color ?? AppTheme.textSecondary)),
          ],
        ],
      ),
    );
  }

  String _formatTime(String timestamp) {
    try {
      final date = DateTime.parse(timestamp);
      final now = DateTime.now();
      final diff = now.difference(date);
      if (diff.inDays > 0) return DateFormat('MMM d').format(date);
      if (diff.inHours > 0) return '${diff.inHours}h';
      if (diff.inMinutes > 0) return '${diff.inMinutes}m';
      return 'now';
    } catch (_) {
      return '';
    }
  }
}
