import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../config/theme.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _stats;
  List<dynamic> _users = [];
  List<dynamic> _activity = [];
  List<dynamic> _recipes = [];
  List<dynamic> _comments = [];
  bool _isLoading = false;
  String? _error;
  String _activeSection = 'dashboard';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      final auth = context.read<AuthProvider>();

      final results = await Future.wait([
        _api.get('/admin/stats'),
        if (auth.isAdmin) _api.get('/admin/users'),
        _api.get('/admin/activity'),
        _api.get('/admin/recipes'),
        _api.get('/admin/comments'),
      ], eagerError: false);
      if (!mounted) return;
      setState(() {
        int i = 0;
        if (results.length > i) _stats = results[i++];
        if (auth.isAdmin && results.length > i) _users = results[i++] is List ? results[i - 1] : (results[i - 1]['users'] ?? []);
        if (results.length > i) _activity = results[i++] is List ? results[i - 1] : (results[i - 1]['activity'] ?? []);
        if (results.length > i) _recipes = results[i++] is List ? results[i - 1] : [];
        if (results.length > i) _comments = results[i++] is List ? results[i - 1] : [];
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.isAdmin && !auth.isModerator) {
      return Scaffold(
        appBar: AppBar(title: const Text('Admin')),
        body: const Center(child: Text('Access denied. Admin or moderator role required.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Error: $_error'),
                      ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: CustomScrollView(
                    slivers: [
                      SliverToBoxAdapter(child: _buildSectionNav()),
                      if (_activeSection == 'dashboard') ..._buildDashboard(),
                      if (_activeSection == 'users') ..._buildUsersSection(auth),
                      if (_activeSection == 'recipes') ..._buildRecipesSection(auth),
                      if (_activeSection == 'comments') ..._buildCommentsSection(auth),
                    ],
                  ),
                ),
    );
  }

  Widget _buildSectionNav() {
    final sections = <_NavItem>[
      _NavItem('dashboard', 'Dashboard', Icons.dashboard),
      _NavItem('users', 'Users', Icons.people),
      _NavItem('recipes', 'Recipes', Icons.menu_book),
      _NavItem('comments', 'Comments', Icons.comment),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: sections.map((s) {
            final active = _activeSection == s.key;
            return Padding(
              padding: const EdgeInsets.only(right: 12),
              child: ChoiceChip(
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(s.icon, size: 18, color: active ? Colors.white : null),
                    const SizedBox(width: 6),
                    Text(s.label, style: TextStyle(color: active ? Colors.white : null, fontSize: 13)),
                  ],
                ),
                selected: active,
                onSelected: (_) => setState(() => _activeSection = s.key),
                selectedColor: AppTheme.primaryColor,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  List<Widget> _buildDashboard() {
    return [
      if (_stats != null) SliverToBoxAdapter(child: _buildStatsGrid()),
      const SliverToBoxAdapter(child: SizedBox(height: 16)),
      const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('Recent Activity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ),
      ),
      const SliverToBoxAdapter(child: SizedBox(height: 8)),
      if (_activity.isEmpty)
        const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No activity yet'))))
      else
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (_, i) {
              final a = _activity[i];
              final action = a['type']?.toString() ?? '';
              return ListTile(
                leading: Icon(_activityIcon(action), color: AppTheme.accentBlue),
                title: Text('${_activityLabel(action)} by ${a['username'] ?? 'unknown'}', style: const TextStyle(fontSize: 13)),
                subtitle: Text(a['timestamp']?.toString() ?? '', style: const TextStyle(fontSize: 11)),
                dense: true,
                onTap: () => _showActivityDetail(a),
              );
            },
            childCount: _activity.length,
          ),
        ),
    ];
  }

  List<Widget> _buildUsersSection(AuthProvider auth) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text('${_users.length} Users', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ),
      ),
      if (_users.isEmpty)
        const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No users found'))))
      else
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (_, i) {
              final u = _users[i];
              final status = u['status'] ?? 'active';
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: status == 'active'
                        ? AppTheme.accentGreen
                        : status == 'suspended'
                            ? AppTheme.accentOrange
                            : Colors.red,
                    child: Text(
                      ((u['username'] is String && (u['username'] as String).isNotEmpty)
                          ? (u['username'] as String)
                          : '?')[0].toUpperCase(),
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                  title: Text(u['username'] ?? 'Unknown', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${u['email'] ?? ''} \u2022 Role: ${u['role'] ?? 'user'} \u2022 Status: $status'
                    '${u['recipe_count'] != null ? ' \u2022 ${u['recipe_count']} recipes' : ''}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.arrow_forward_ios, size: 16),
                    onPressed: () => _showUserDetail(context, u, auth),
                  ),
                  onTap: () => _showUserDetail(context, u, auth),
                ),
              );
            },
            childCount: _users.length,
          ),
        ),
    ];
  }

  List<Widget> _buildRecipesSection(AuthProvider auth) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Text('${_recipes.length} Recipes', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const Spacer(),
              if (auth.isAdmin || auth.isModerator)
                Text('Moderator access', style: TextStyle(fontSize: 12, color: AppTheme.accentOrange)),
            ],
          ),
        ),
      ),
      if (_recipes.isEmpty)
        const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No recipes found'))))
      else
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (_, i) {
              final r = _recipes[i];
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.15),
                    child: const Icon(Icons.menu_book, color: AppTheme.primaryColor, size: 20),
                  ),
                  title: Text(r['title'] ?? 'Untitled', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    'by ${r['author_username'] ?? 'unknown'}'
                    '${r['likes'] != null ? ' \u2022 ${r['likes']} likes' : ''}'
                    '${r['comments'] != null ? ' \u2022 ${r['comments']} comments' : ''}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.arrow_forward_ios, size: 16),
                    onPressed: () => _showRecipeDetail(context, r, auth),
                  ),
                  onTap: () => _showRecipeDetail(context, r, auth),
                ),
              );
            },
            childCount: _recipes.length,
          ),
        ),
    ];
  }

  List<Widget> _buildCommentsSection(AuthProvider auth) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Text('${_comments.length} Comments', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const Spacer(),
              if (auth.isAdmin || auth.isModerator)
                Text('Moderator access', style: TextStyle(fontSize: 12, color: AppTheme.accentOrange)),
            ],
          ),
        ),
      ),
      if (_comments.isEmpty)
        const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No comments found'))))
      else
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (_, i) {
              final c = _comments[i];
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppTheme.accentBlue.withValues(alpha: 0.15),
                    child: const Icon(Icons.comment, color: AppTheme.accentBlue, size: 20),
                  ),
                  title: Text(
                    (c['content']?.toString() ?? '').length > 60
                        ? '${(c['content']?.toString() ?? '').substring(0, 60)}...'
                        : c['content']?.toString() ?? '',
                    style: const TextStyle(fontSize: 13),
                  ),
                  subtitle: Text(
                    'by ${c['author_username'] ?? 'unknown'} on ${c['recipe_title'] ?? 'recipe'}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.arrow_forward_ios, size: 16),
                    onPressed: () => _showCommentDetail(context, c, auth),
                  ),
                  onTap: () => _showCommentDetail(context, c, auth),
                ),
              );
            },
            childCount: _comments.length,
          ),
        ),
    ];
  }

  Widget _buildStatsGrid() {
    final s = _stats!;
    final users = s['users'] as Map<String, dynamic>? ?? {};
    final recipes = s['recipes'] as Map<String, dynamic>? ?? {};
    final engagement = s['engagement'] as Map<String, dynamic>? ?? {};
    final roles = (users['byRole'] as List?) ?? [];
    final adminCount = roles.where((r) => r['role'] == 'admin').fold(0, (sum, r) => sum + (r['count'] is num ? (r['count'] as num).toInt() : 0));
    final modCount = roles.where((r) => r['role'] == 'moderator').fold(0, (sum, r) => sum + (r['count'] is num ? (r['count'] as num).toInt() : 0));

    final items = <_StatItem>[
      _StatItem('Recipes', '${recipes['total'] ?? 0}', Icons.menu_book, () => setState(() => _activeSection = 'recipes')),
      _StatItem('Users', '${users['total'] ?? 0}', Icons.people, () => setState(() => _activeSection = 'users')),
      _StatItem('Admins', '$adminCount', Icons.admin_panel_settings, null),
      _StatItem('Moderators', '$modCount', Icons.shield, null),
      _StatItem('Ratings', '${engagement['ratings'] ?? 0}', Icons.star, null),
      _StatItem('Comments', '${engagement['comments'] ?? 0}', Icons.comment, () => setState(() => _activeSection = 'comments')),
    ];

    return Padding(
      padding: const EdgeInsets.all(16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3, childAspectRatio: 1.2, crossAxisSpacing: 8, mainAxisSpacing: 8,
        ),
        itemCount: items.length,
        itemBuilder: (_, i) => Card(
          child: InkWell(
            onTap: items[i].onTap,
            borderRadius: BorderRadius.circular(12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(items[i].icon, color: AppTheme.primaryColor, size: 28),
                const SizedBox(height: 4),
                Text(items[i].value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Text(items[i].label, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showUserDetail(BuildContext ctx, dynamic user, AuthProvider auth) async {
    final uid = (user['id'] is num) ? (user['id'] as num).toInt() : user['id'];
    Map<String, dynamic>? details;
    try {
      details = await _api.get('/admin/users/$uid');
    } catch (_) {}

    if (!mounted) return;
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollCtrl) => SingleChildScrollView(
          controller: scrollCtrl,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: AppTheme.primaryColor,
                    child: Text(
                      ((user['username'] is String && (user['username'] as String).isNotEmpty)
                          ? (user['username'] as String)
                          : '?')[0].toUpperCase(),
                      style: const TextStyle(fontSize: 24, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user['name'] ?? user['username'] ?? 'Unknown', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                        Text('@${user['username'] ?? ''}', style: const TextStyle(color: AppTheme.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _detailRow(Icons.email, user['email'] ?? 'No email'),
              _detailRow(Icons.badge, 'Role: ${user['role'] ?? 'user'}'),
              _detailRow(Icons.circle, 'Status: ${user['status'] ?? 'active'}',
                  color: (user['status'] ?? 'active') == 'active' ? AppTheme.accentGreen
                      : (user['status'] ?? '') == 'suspended' ? AppTheme.accentOrange : Colors.red),
              if (details != null) ...[
                const Divider(),
                Text('User Details', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                if (details['user'] != null) ...[
                  _detailRow(Icons.people, '${details['user']['followers'] ?? 0} followers'),
                  _detailRow(Icons.person_add, 'Following ${details['user']['following'] ?? 0}'),
                ],
                if (details['recipes'] is List && (details['recipes'] as List).isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text('Recipes (${(details['recipes'] as List).length})', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ...(details['recipes'] as List).take(5).map((r) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(r['title'] ?? '', style: const TextStyle(fontSize: 13)),
                    subtitle: Text('${r['likes'] ?? 0} likes \u2022 ${r['comments'] ?? 0} comments', style: const TextStyle(fontSize: 11)),
                  )),
                ],
                if (details['comments'] is List && (details['comments'] as List).isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('Recent Comments', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ...(details['comments'] as List).take(3).map((c) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      (c['content']?.toString() ?? '').length > 40
                          ? '${(c['content']?.toString() ?? '').substring(0, 40)}...'
                          : c['content']?.toString() ?? '',
                      style: const TextStyle(fontSize: 12),
                    ),
                    subtitle: Text('on ${c['recipe_title'] ?? ''}', style: const TextStyle(fontSize: 11)),
                  )),
                ],
              ],
              if (auth.isAdmin) ...[
                const SizedBox(height: 16),
                const Divider(),
                Text('Admin Actions', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _actionChip('Set Active', AppTheme.accentGreen, () => _updateUserStatus(uid, 'active', sheetCtx)),
                    _actionChip('Suspend', AppTheme.accentOrange, () => _updateUserStatus(uid, 'suspended', sheetCtx)),
                    _actionChip('Ban', Colors.red, () => _updateUserStatus(uid, 'banned', sheetCtx)),
                    _actionChip('Delete User', Colors.red, () => _deleteUser(uid, sheetCtx), isDelete: true),
                  ],
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showRecipeDetail(BuildContext ctx, dynamic recipe, AuthProvider auth) async {
    if (!mounted) return;
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        maxChildSize: 0.7,
        minChildSize: 0.3,
        expand: false,
        builder: (_, scrollCtrl) => SingleChildScrollView(
          controller: scrollCtrl,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.15),
                    child: const Icon(Icons.menu_book, color: AppTheme.primaryColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(recipe['title'] ?? 'Untitled', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _detailRow(Icons.person, 'by ${recipe['author_username'] ?? 'unknown'}'),
              _detailRow(Icons.thumb_up, '${recipe['likes'] ?? 0} likes'),
              _detailRow(Icons.comment, '${recipe['comments'] ?? 0} comments'),
              _detailRow(Icons.star, '${recipe['ratings'] ?? 0} ratings'),
              if (recipe['description']?.toString().isNotEmpty == true) ...[
                const SizedBox(height: 8),
                Text('Description', style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(recipe['description']?.toString() ?? '', style: const TextStyle(color: AppTheme.textSecondary)),
              ],
              if (auth.isAdmin || auth.isModerator) ...[
                const SizedBox(height: 16),
                const Divider(),
                Text('Moderator Actions', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.accentOrange)),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _deleteRecipe(recipe['id'] is num ? (recipe['id'] as num).toInt() : recipe['id'], sheetCtx),
                    icon: const Icon(Icons.delete, color: Colors.white),
                    label: const Text('Delete Recipe'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  ),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showCommentDetail(BuildContext ctx, dynamic comment, AuthProvider auth) async {
    if (!mounted) return;
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => DraggableScrollableSheet(
        initialChildSize: 0.4,
        maxChildSize: 0.6,
        minChildSize: 0.3,
        expand: false,
        builder: (_, scrollCtrl) => SingleChildScrollView(
          controller: scrollCtrl,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppTheme.accentBlue.withValues(alpha: 0.15),
                    child: const Icon(Icons.comment, color: AppTheme.accentBlue),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('Comment by ${comment['author_username'] ?? 'unknown'}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(comment['content']?.toString() ?? '', style: const TextStyle(fontSize: 14)),
              ),
              const SizedBox(height: 8),
              _detailRow(Icons.menu_book, 'On recipe: ${comment['recipe_title'] ?? 'Unknown'}'),
              if (auth.isAdmin || auth.isModerator) ...[
                const SizedBox(height: 16),
                const Divider(),
                Text('Moderator Actions', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.accentOrange)),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _deleteComment(comment['id'] is num ? (comment['id'] as num).toInt() : comment['id'], sheetCtx),
                    icon: const Icon(Icons.delete, color: Colors.white),
                    label: const Text('Delete Comment'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  ),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  void _showActivityDetail(dynamic activity) {
    final action = activity['type']?.toString() ?? '';
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(_activityLabel(action)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _detailRow(Icons.person, 'User: ${activity['username'] ?? 'unknown'}'),
            _detailRow(Icons.category, 'Type: ${_activityLabel(action)}'),
            _detailRow(Icons.access_time, 'Time: ${activity['timestamp'] ?? ''}'),
          ],
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
  }

  Widget _detailRow(IconData icon, String text, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color ?? AppTheme.textSecondary),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: color ?? AppTheme.textPrimary))),
        ],
      ),
    );
  }

  Widget _actionChip(String label, Color color, VoidCallback onTap, {bool isDelete = false}) {
    return ActionChip(
      label: Text(label, style: TextStyle(color: isDelete ? Colors.white : color, fontSize: 12)),
      backgroundColor: isDelete ? color : color.withValues(alpha: 0.1),
      onPressed: onTap,
      side: BorderSide.none,
    );
  }

  Future<void> _updateUserStatus(int userId, String status, BuildContext sheetCtx) async {
    try {
      await _api.patch('/admin/users/$userId/status', body: {'status': status});
      if (mounted) Navigator.pop(sheetCtx);
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('User status updated to $status'), backgroundColor: AppTheme.accentGreen),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _deleteUser(int userId, BuildContext sheetCtx) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete User'),
        content: const Text('Are you sure? This cannot be undone.\nAll user data will be permanently removed.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('/admin/users/$userId');
        if (mounted) Navigator.pop(sheetCtx);
        _loadData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('User deleted'), backgroundColor: Colors.red),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _deleteRecipe(int recipeId, BuildContext sheetCtx) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Recipe'),
        content: const Text('Are you sure? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('/admin/recipes/$recipeId');
        if (mounted) Navigator.pop(sheetCtx);
        _loadData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Recipe deleted'), backgroundColor: Colors.red),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _deleteComment(int commentId, BuildContext sheetCtx) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Comment'),
        content: const Text('Are you sure? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _api.delete('/admin/comments/$commentId');
        if (mounted) Navigator.pop(sheetCtx);
        _loadData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Comment deleted'), backgroundColor: Colors.red),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  String _activityLabel(String type) {
    switch (type) {
      case 'recipe_created': return 'Created recipe';
      case 'comment_posted': return 'Posted comment';
      case 'recipe_rated': return 'Rated recipe';
      case 'user_registered': return 'Registered';
      default: return type;
    }
  }

  IconData _activityIcon(String type) {
    if (type.contains('recipe_created')) return Icons.add_circle_outline;
    if (type.contains('comment_posted')) return Icons.chat_bubble_outline;
    if (type.contains('recipe_rated')) return Icons.star_outline;
    if (type.contains('user_registered')) return Icons.person_add_outlined;
    return Icons.circle;
  }
}

class _StatItem {
  final String label;
  final String value;
  final IconData icon;
  final VoidCallback? onTap;
  _StatItem(this.label, this.value, this.icon, this.onTap);
}

class _NavItem {
  final String key;
  final String label;
  final IconData icon;
  _NavItem(this.key, this.label, this.icon);
}
