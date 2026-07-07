import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/recipe_provider.dart';
import '../widgets/recipe_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_display.dart';

class MyRecipesScreen extends StatefulWidget {
  const MyRecipesScreen({super.key});

  @override
  State<MyRecipesScreen> createState() => _MyRecipesScreenState();
}

class _MyRecipesScreenState extends State<MyRecipesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final userId = context.read<AuthProvider>().user?.id;
      if (userId != null) {
        context.read<RecipeProvider>().loadMyRecipes(userId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Recipes')),
      body: Consumer<RecipeProvider>(
        builder: (_, rp, __) {
          if (rp.isLoading) return const Center(child: CircularProgressIndicator());
          if (rp.error != null) return ErrorDisplay(message: rp.error!, onRetry: () {
            final userId = context.read<AuthProvider>().user?.id;
            if (userId != null) rp.loadMyRecipes(userId);
          });
          if (rp.myRecipes.isEmpty) {
            return EmptyState(
              icon: Icons.menu_book_outlined,
              title: 'No recipes yet',
              subtitle: 'Start by adding your first recipe!',
              actionLabel: 'Add Recipe',
              onAction: () => Navigator.of(context).pushNamed('/add-recipe'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              final userId = context.read<AuthProvider>().user?.id;
              if (userId != null) rp.loadMyRecipes(userId);
            },
            child: GridView.builder(
              padding: const EdgeInsets.all(8),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, childAspectRatio: 0.72, crossAxisSpacing: 8, mainAxisSpacing: 8,
              ),
              itemCount: rp.myRecipes.length,
              itemBuilder: (_, i) => RecipeCard(
                recipe: rp.myRecipes[i],
                onTap: () => Navigator.of(context).pushNamed('/recipe-detail', arguments: rp.myRecipes[i].id),
                onFavoriteTap: () {
                  final userId = context.read<AuthProvider>().user?.id;
                  rp.toggleFavorite(rp.myRecipes[i].id, userId: userId);
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
