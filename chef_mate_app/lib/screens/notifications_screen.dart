import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/notification_provider.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_display.dart';
import '../config/theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          Consumer<NotificationProvider>(
            builder: (_, notif, __) => TextButton(
              onPressed: notif.unreadCount > 0 ? () => notif.markAllAsRead() : null,
              child: const Text('Mark all read', style: TextStyle(color: Colors.white)),
            ),
          ),
        ],
      ),
      body: Consumer<NotificationProvider>(
        builder: (_, notif, __) {
          if (notif.isLoading) return const Center(child: CircularProgressIndicator());
          if (notif.error != null) return ErrorDisplay(message: notif.error!, onRetry: () => notif.loadNotifications());
          if (notif.notifications.isEmpty) {
            return const EmptyState(
              icon: Icons.notifications_none,
              title: 'No notifications',
              subtitle: 'You\'ll see notifications here when someone interacts with your recipes',
            );
          }
          return RefreshIndicator(
            onRefresh: () => notif.loadNotifications(),
            child: ListView.builder(
              itemCount: notif.notifications.length,
              itemBuilder: (_, i) {
                final n = notif.notifications[i];
                return ListTile(
                  leading: CircleAvatar(
                    radius: 20,
                    backgroundImage: n.actorAvatar != null ? CachedNetworkImageProvider(n.actorAvatar!) : null,
                    child: n.actorAvatar == null
                        ? Text(((n.actorName ?? n.actorUsername ?? '?').isNotEmpty ? (n.actorName ?? n.actorUsername ?? '?') : '?')[0].toUpperCase())
                        : null,
                  ),
                  title: Text(n.message, style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold, fontSize: 14)),
                  subtitle: n.createdAt != null ? Text(_formatTime(n.createdAt!), style: const TextStyle(fontSize: 12)) : null,
                  trailing: n.isRead ? null : Container(width: 10, height: 10, decoration: const BoxDecoration(color: AppTheme.primaryColor, shape: BoxShape.circle)),
                  onTap: () {
                    notif.markAsRead(n.id);
                    if (n.recipeId > 0) {
                      Navigator.of(context).pushNamed('/recipe-detail', arguments: n.recipeId);
                    }
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }

  String _formatTime(String timestamp) {
    try {
      final date = DateTime.parse(timestamp);
      final now = DateTime.now();
      final diff = now.difference(date);
      if (diff.inDays > 0) return DateFormat('MMM d').format(date);
      if (diff.inHours > 0) return '${diff.inHours}h ago';
      if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
      return 'Just now';
    } catch (_) {
      return '';
    }
  }
}
