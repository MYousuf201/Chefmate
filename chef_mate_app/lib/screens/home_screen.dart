import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/auth_provider.dart';
import '../providers/recipe_provider.dart';
import '../providers/notification_provider.dart';
import '../widgets/recipe_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_display.dart';
import '../config/theme.dart';
import '../config/api_config.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RecipeProvider>().loadRecipes();
      context.read<NotificationProvider>().startPolling();
    });
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    context.read<NotificationProvider>().stopPolling();
    super.dispose();
  }

  void _onScroll() {
    final rp = context.read<RecipeProvider>();
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 300) {
      rp.loadMoreRecipes();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _buildHeader(),
          _buildSearchSection(),
          Expanded(child: _buildBody()),
        ],
      ),
      floatingActionButton: _buildFab(),
    );
  }

  Widget _buildHeader() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 16,
        left: 20,
        right: 20,
        bottom: 8,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '\u{1F373} Chef-Mate',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Discover amazing recipes today',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),
          Consumer<NotificationProvider>(
            builder: (_, notif, __) => Stack(
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                  onPressed: () => Navigator.of(context).pushNamed('/notifications'),
                ),
                if (notif.unreadCount > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: Text(
                        '${notif.unreadCount}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Consumer<AuthProvider>(
            builder: (_, auth, __) => PopupMenuButton<String>(
              icon: CircleAvatar(
                radius: 16,
                backgroundColor: Colors.white24,
                child: Text(
                  ((auth.user?.name ?? auth.user?.username)?.isNotEmpty == true
                      ? (auth.user?.name ?? auth.user?.username)!
                      : 'U')[0].toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              onSelected: (value) {
                switch (value) {
                  case 'profile':
                    Navigator.of(context).pushNamed('/profile');
                    break;
                  case 'my_recipes':
                    Navigator.of(context).pushNamed('/my-recipes');
                    break;
                  case 'favorites':
                    Navigator.of(context).pushNamed('/favorites');
                    break;
                  case 'add_recipe':
                    Navigator.of(context).pushNamed('/add-recipe');
                    break;
                  case 'admin':
                    Navigator.of(context).pushNamed('/admin');
                    break;
                  case 'logout':
                    auth.logout();
                    Navigator.of(context).pushReplacementNamed('/login');
                    break;
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'profile', child: ListTile(leading: Icon(Icons.person), title: Text('Profile'))),
                const PopupMenuItem(value: 'my_recipes', child: ListTile(leading: Icon(Icons.menu_book), title: Text('My Recipes'))),
                const PopupMenuItem(value: 'favorites', child: ListTile(leading: Icon(Icons.favorite), title: Text('Favorites'))),
                const PopupMenuItem(value: 'add_recipe', child: ListTile(leading: Icon(Icons.add_circle), title: Text('Add Recipe'))),
                if (auth.isAdmin || auth.isModerator)
                  const PopupMenuItem(value: 'admin', child: ListTile(leading: Icon(Icons.admin_panel_settings), title: Text('Admin'))),
                const PopupMenuItem(value: 'logout', child: ListTile(leading: Icon(Icons.logout), title: Text('Logout'))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchSection() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search recipes...',
                hintStyle: const TextStyle(color: Color(0xFF999999)),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF999999)),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Color(0xFF999999)),
                        onPressed: () {
                          _searchController.clear();
                          context.read<RecipeProvider>().setSearchQuery('');
                          context.read<RecipeProvider>().loadRecipes();
                        },
                      )
                    : null,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onSubmitted: (value) {
                context.read<RecipeProvider>().setSearchQuery(value);
                context.read<RecipeProvider>().loadRecipes();
              },
            ),
          ),
          const SizedBox(height: 12),
          _buildFilterChips(),
          const SizedBox(height: 12),
          _buildSmartSearchButton(),
        ],
      ),
    );
  }

  Widget _buildSmartSearchButton() {
    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed('/smart-search'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Text('Smart Search', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    final cuisines = ['All', 'Italian', 'Mexican', 'Asian', 'Desserts'];
    return Consumer<RecipeProvider>(
      builder: (_, rp, __) => SizedBox(
        height: 36,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            ...cuisines.map((c) {
              final isSelected = c == 'All'
                  ? rp.cuisineFilter == null
                  : rp.cuisineFilter?.toLowerCase() == c.toLowerCase();
              return Padding(
                padding: const EdgeInsets.only(right: 12),
                child: GestureDetector(
                  onTap: () {
                    rp.setCuisineFilter(c == 'All' ? null : c);
                    rp.loadRecipes();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primaryColor : const Color(0xFFF0F0F0),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? AppTheme.primaryColor : const Color(0xFFE0E0E0),
                      ),
                    ),
                    child: Text(
                      c,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
                        color: isSelected ? Colors.white : AppTheme.textSecondary,
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    return Consumer<RecipeProvider>(
      builder: (_, rp, __) {
        if (rp.isLoading && rp.recipes.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }
        if (rp.error != null) {
          return ErrorDisplay(message: rp.error!, onRetry: () => rp.loadRecipes());
        }
        if (rp.recipes.isEmpty) {
          return EmptyState(
            icon: Icons.restaurant_outlined,
            title: 'No recipes found',
            subtitle: rp.searchQuery.isNotEmpty ? 'Try a different search term' : 'Be the first to add a recipe!',
            actionLabel: 'Add Recipe',
            onAction: () => Navigator.of(context).pushNamed('/add-recipe'),
          );
        }
        return RefreshIndicator(
          onRefresh: () => rp.loadRecipes(refresh: true),
          child: ListView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 80),
            children: [
              _buildTrendingSection(rp),
              const SizedBox(height: 8),
              _buildSectionTitle('\u{2B50} Popular Recipes'),
              ...rp.recipes.map((recipe) => RecipeCard(
                recipe: recipe,
                onTap: () => Navigator.of(context).pushNamed('/recipe-detail', arguments: recipe.id),
                onFavoriteTap: () {
                  final userId = context.read<AuthProvider>().user?.id;
                  rp.toggleFavorite(recipe.id, userId: userId);
                },
              )),
              if (rp.isLoadingMore)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (!rp.hasMore && rp.recipes.isNotEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text(
                      'All recipes loaded',
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTrendingSection(RecipeProvider rp) {
    final trending = rp.recipes.take(5).toList();
    if (trending.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('\u{1F525} Trending Now'),
        SizedBox(
          height: 160,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: trending.map((recipe) => _buildTrendingCard(recipe, rp)).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildTrendingCard(recipe, RecipeProvider rp) {
    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed('/recipe-detail', arguments: recipe.id),
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              child: SizedBox(
                height: 100,
                width: double.infinity,
                child: _buildTrendingImage(recipe),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      recipe.title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        const Icon(Icons.access_time, size: 12, color: AppTheme.textSecondary),
                        const SizedBox(width: 3),
                        Text(
                          '${recipe.prepTime + recipe.cookTime} min',
                          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppTheme.textPrimary,
        ),
      ),
    );
  }

  Widget _buildTrendingImage(recipe) {
    final imgUrl = ApiConfig.resolveImageUrl(recipe.imageUrl);
    final placeholder = Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(child: Icon(Icons.restaurant, size: 36, color: Colors.white.withOpacity(0.5))),
    );
    if (imgUrl != null) {
      return CachedNetworkImage(
        imageUrl: imgUrl,
        fit: BoxFit.cover,
        placeholder: (_, __) => placeholder,
        errorWidget: (_, __, ___) => placeholder,
      );
    }
    return placeholder;
  }

  Widget _buildFab() {
    return Container(
      width: 56,
      height: 56,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(255, 107, 107, 0.4),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: FloatingActionButton(
        onPressed: () => Navigator.of(context).pushNamed('/add-recipe'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: const Icon(Icons.add, color: Colors.white, size: 28),
      ),
    );
  }
}
