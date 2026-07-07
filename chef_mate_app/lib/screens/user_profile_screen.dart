import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/user_provider.dart';
import '../providers/recipe_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/recipe_card.dart';
import '../widgets/error_display.dart';
import '../config/theme.dart';

class UserProfileScreen extends StatefulWidget {
  final int userId;

  const UserProfileScreen({super.key, required this.userId});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final up = context.read<UserProvider>();
      up.loadUser(widget.userId);
      context.read<RecipeProvider>().loadMyRecipes(widget.userId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: Consumer2<UserProvider, RecipeProvider>(
        builder: (_, up, rp, __) {
          if (up.isLoading) return const Center(child: CircularProgressIndicator());
          if (up.error != null) return ErrorDisplay(message: up.error!, onRetry: () => up.loadUser(widget.userId));

          final user = up.viewedUser;
          if (user == null) return const Center(child: Text('User not found'));

          final isOwnProfile = context.read<AuthProvider>().user?.id == widget.userId;

          return SingleChildScrollView(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        backgroundImage: user.avatarUrl != null ? CachedNetworkImageProvider(user.avatarUrl!) : null,
                        child: user.avatarUrl == null
                            ? Text(((user.name ?? user.username).isNotEmpty ? (user.name ?? user.username) : 'U')[0].toUpperCase(), style: const TextStyle(fontSize: 28))
                            : null,
                      ),
                      const SizedBox(height: 8),
                      Text(user.name ?? user.username, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      Text('@${user.username}', style: const TextStyle(color: AppTheme.textSecondary)),
                      if (user.bio != null && user.bio!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(user.bio!, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textSecondary)),
                      ],
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _statItem('${user.recipeCount ?? 0}', 'Recipes'),
                          _statItem('${user.followerCount ?? 0}', 'Followers'),
                          _statItem('${user.followingCount ?? 0}', 'Following'),
                        ],
                      ),
                      if (!isOwnProfile) ...[
                        const SizedBox(height: 16),
                        Consumer<UserProvider>(
                          builder: (_, up2, __) => ElevatedButton.icon(
                            onPressed: () => up2.toggleFollow(widget.userId),
                            icon: Icon(user.isFollowing == true ? Icons.person_remove : Icons.person_add),
                            label: Text(user.isFollowing == true ? 'Unfollow' : 'Follow'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: user.isFollowing == true ? Colors.grey[300] : AppTheme.primaryColor,
                              foregroundColor: user.isFollowing == true ? Colors.black87 : Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Divider(),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Recipes by ${user.name ?? user.username}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                ),
                if (rp.isLoading)
                  const Center(child: CircularProgressIndicator())
                else if (rp.myRecipes.isEmpty)
                  const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No recipes yet')))
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(8),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2, childAspectRatio: 0.72, crossAxisSpacing: 8, mainAxisSpacing: 8,
                    ),
                    itemCount: rp.myRecipes.length,
                    itemBuilder: (_, i) => RecipeCard(
                      recipe: rp.myRecipes[i],
                      onTap: () => Navigator.of(context).pushNamed('/recipe-detail', arguments: rp.myRecipes[i].id),
                    ),
                  ),
              ],
            ),
          );
        },
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

  @override
  void dispose() {
    context.read<UserProvider>().clear();
    super.dispose();
  }
}
