import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../config/theme.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  final _api = ApiService();
  List<dynamic> _users = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await _api.get('/admin/users');
      if (!mounted) return;
      setState(() => _users = data['users'] ?? ((data is List ? data : [])));
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  Future<void> _showStatusMenu(BuildContext ctx, dynamic user) async {
    final value = await showDialog<String>(
      context: ctx,
      builder: (dialogCtx) => SimpleDialog(
        title: Text('Status for ${user['username'] ?? 'user'}'),
        children: [
          SimpleDialogOption(onPressed: () => Navigator.pop(dialogCtx, 'active'), child: const Text('Set Active')),
          SimpleDialogOption(onPressed: () => Navigator.pop(dialogCtx, 'suspended'), child: const Text('Suspend')),
          SimpleDialogOption(onPressed: () => Navigator.pop(dialogCtx, 'banned'), child: const Text('Ban')),
        ],
      ),
    );
    if (value != null && mounted) {
      try {
        final uid = (user['id'] is num) ? (user['id'] as num).toInt() : user['id'];
        await _api.patch('/admin/users/$uid/status', body: {'status': value});
        if (mounted) _loadUsers();
      } catch (e) {
        if (mounted) setState(() => _error = 'Failed to update status: $e');
      }
    }
  }

  Future<void> _deleteUser(int userId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete User'),
        content: const Text('Are you sure? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('/admin/users/$userId');
        _loadUsers();
      } catch (e) {
        if (mounted) setState(() => _error = 'Failed to delete user: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('User Management')),
        body: const Center(child: Text('Access denied. Admin role required.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('User Management')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Error: $_error'),
                      ElevatedButton(onPressed: _loadUsers, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadUsers,
                  child: ListView.builder(
                    itemCount: _users.length,
                    itemBuilder: (_, i) {
                      final u = _users[i];
                      final status = u['status'] ?? 'active';
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: status == 'active'
                              ? AppTheme.accentGreen
                              : status == 'suspended'
                                  ? AppTheme.accentOrange
                                  : Colors.red,
                          child: Text(((u['username'] is String && (u['username'] as String).isNotEmpty) ? (u['username'] as String) : '?')[0].toUpperCase(), style: const TextStyle(color: Colors.white)),
                        ),
                        title: Text(u['username'] ?? 'Unknown', style: const TextStyle(fontSize: 14)),
                        subtitle: Text('${u['email'] ?? ''} | Role: ${u['role'] ?? 'user'} | Status: $status', style: const TextStyle(fontSize: 11)),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.more_vert),
                              onPressed: () => _showStatusMenu(context, u),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete, color: Colors.red, size: 20),
                              onPressed: () => _deleteUser(u['id'] is num ? (u['id'] as num).toInt() : u['id']),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
