import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/recipe_provider.dart';
import '../widgets/recipe_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_display.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final userId = context.read<AuthProvider>().user?.id;
      if (userId != null) {
        context.read<RecipeProvider>().loadFavorites(userId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Favorites')),
      body: Consumer<RecipeProvider>(
        builder: (_, rp, __) {
          if (rp.isLoading) return const Center(child: CircularProgressIndicator());
          if (rp.error != null) return ErrorDisplay(message: rp.error!, onRetry: () {
            final userId = context.read<AuthProvider>().user?.id;
            if (userId != null) rp.loadFavorites(userId);
          });
          if (rp.favorites.isEmpty) {
            return EmptyState(
              icon: Icons.favorite_outlined,
              title: 'No favorites yet',
              subtitle: 'Tap the heart icon on recipes to save them here',
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              final userId = context.read<AuthProvider>().user?.id;
              if (userId != null) rp.loadFavorites(userId);
            },
            child: GridView.builder(
              padding: const EdgeInsets.all(8),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, childAspectRatio: 0.72, crossAxisSpacing: 8, mainAxisSpacing: 8,
              ),
              itemCount: rp.favorites.length,
              itemBuilder: (_, i) => RecipeCard(
                recipe: rp.favorites[i],
                onTap: () => Navigator.of(context).pushNamed('/recipe-detail', arguments: rp.favorites[i].id),
                onFavoriteTap: () {
                  final userId = context.read<AuthProvider>().user?.id;
                  rp.toggleFavorite(rp.favorites[i].id, userId: userId);
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
