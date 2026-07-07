import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/auth_provider.dart';
import '../config/theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: Consumer<AuthProvider>(
        builder: (_, auth, __) {
          final user = auth.user;
          if (user == null) return const Center(child: Text('Not logged in'));

          return Column(
            children: [
              _buildProfileHeader(user),
              _buildStatsRow(user),
              TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(text: 'Profile'),
                  Tab(text: 'Security'),
                  Tab(text: 'Preferences'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _ProfileTab(user: user, auth: auth),
                    _SecurityTab(auth: auth),
                    _PreferencesTab(auth: auth),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildProfileHeader(user) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          CircleAvatar(
            radius: 40,
            backgroundImage: user.avatarUrl != null ? CachedNetworkImageProvider(user.avatarUrl!) : null,
            child: user.avatarUrl == null
                ? Text(((user.name ?? user.username ?? 'U').isNotEmpty ? (user.name ?? user.username ?? 'U') : 'U')[0].toUpperCase(), style: const TextStyle(fontSize: 28))
                : null,
          ),
          const SizedBox(height: 8),
          Text(user.name ?? user.username, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          Text('@${user.username}', style: const TextStyle(color: AppTheme.textSecondary)),
          if (user.bio != null && user.bio!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(user.bio!, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textSecondary)),
          ],
        ],
      ),
    );
  }

  Widget _buildStatsRow(user) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _statItem('${user.recipeCount ?? 0}', 'Recipes'),
          _statItem('${user.followerCount ?? 0}', 'Followers'),
          _statItem('${user.followingCount ?? 0}', 'Following'),
        ],
      ),
    );
  }

  Widget _statItem(String value, String label) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
      ],
    );
  }
}

class _ProfileTab extends StatelessWidget {
  final user;
  final AuthProvider auth;

  const _ProfileTab({required this.user, required this.auth});

  @override
  Widget build(BuildContext context) {
    final controllers = {
      'name': TextEditingController(text: user.name ?? ''),
      'username': TextEditingController(text: user.username ?? ''),
      'email': TextEditingController(text: user.email ?? ''),
      'bio': TextEditingController(text: user.bio ?? ''),
    };

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(controller: controllers['name']!, decoration: const InputDecoration(labelText: 'Name'), readOnly: true),
          const SizedBox(height: 12),
          TextField(controller: controllers['username']!, decoration: const InputDecoration(labelText: 'Username'), readOnly: true),
          const SizedBox(height: 12),
          TextField(controller: controllers['email']!, decoration: const InputDecoration(labelText: 'Email'), readOnly: true),
          const SizedBox(height: 12),
          TextField(controller: controllers['bio']!, decoration: const InputDecoration(labelText: 'Bio'), maxLines: 3),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              auth.updateProfile({
                'username': controllers['username']!.text.trim(),
                'name': controllers['name']!.text.trim(),
                'bio': controllers['bio']!.text.trim(),
              });
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated')));
            },
            child: const Text('Save Profile'),
          ),
        ],
      ),
    );
  }
}

class _SecurityTab extends StatelessWidget {
  final AuthProvider auth;
  const _SecurityTab({required this.auth});

  @override
  Widget build(BuildContext context) {
    final currentPw = TextEditingController();
    final newPw = TextEditingController();
    final confirmPw = TextEditingController();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(controller: currentPw, decoration: const InputDecoration(labelText: 'Current Password'), obscureText: true),
          const SizedBox(height: 12),
          TextField(controller: newPw, decoration: const InputDecoration(labelText: 'New Password'), obscureText: true),
          const SizedBox(height: 12),
          TextField(controller: confirmPw, decoration: const InputDecoration(labelText: 'Confirm New Password'), obscureText: true),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () async {
              if (newPw.text != confirmPw.text) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Passwords do not match')));
                return;
              }
              if (newPw.text.length < 8) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password must be at least 8 characters')));
                return;
              }
              final ok = await auth.changePassword(currentPw.text, newPw.text);
              if (ok && context.mounted) {
                currentPw.clear();
                newPw.clear();
                confirmPw.clear();
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password changed')));
              }
            },
            child: const Text('Change Password'),
          ),
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () async {
              auth.logout();
              if (context.mounted) Navigator.of(context).pushReplacementNamed('/login');
            },
            style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

class _PreferencesTab extends StatelessWidget {
  final AuthProvider auth;
  const _PreferencesTab({required this.auth});

  @override
  Widget build(BuildContext context) {
    final prefs = {
      'dietary_restrictions': TextEditingController(text: auth.user?.dietaryRestrictions?.join(', ') ?? ''),
      'allergies': TextEditingController(text: auth.user?.allergies?.join(', ') ?? ''),
      'preferred_cuisines': TextEditingController(text: auth.user?.preferredCuisines?.join(', ') ?? ''),
    };

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(controller: prefs['dietary_restrictions']!, decoration: const InputDecoration(labelText: 'Dietary Restrictions (comma-separated)'), maxLines: 2),
          const SizedBox(height: 12),
          TextField(controller: prefs['allergies']!, decoration: const InputDecoration(labelText: 'Allergies (comma-separated)'), maxLines: 2),
          const SizedBox(height: 12),
          TextField(controller: prefs['preferred_cuisines']!, decoration: const InputDecoration(labelText: 'Preferred Cuisines (comma-separated)'), maxLines: 2),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              auth.updatePreferences({
                'dietary_restrictions': prefs['dietary_restrictions']!.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
                'allergies': prefs['allergies']!.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
                'preferred_cuisines': prefs['preferred_cuisines']!.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
              });
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Preferences updated')));
            },
            child: const Text('Save Preferences'),
          ),
        ],
      ),
    );
  }
}
