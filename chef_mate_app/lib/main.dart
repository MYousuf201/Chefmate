import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config/theme.dart';
import 'models/recipe.dart';
import 'providers/auth_provider.dart';
import 'providers/recipe_provider.dart';
import 'providers/user_provider.dart';
import 'providers/notification_provider.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/recipe_detail_screen.dart';
import 'screens/add_recipe_screen.dart';
import 'screens/my_recipes_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/user_profile_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/admin_screen.dart';
import 'screens/admin_users_screen.dart';
import 'screens/smart_search_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => RecipeProvider()),
        ChangeNotifierProvider(create: (_) => UserProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
      ],
      child: const ChefMateApp(),
    ),
  );
}

class ChefMateApp extends StatelessWidget {
  const ChefMateApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chef-Mate',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      initialRoute: '/splash',
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/splash':
            return MaterialPageRoute(builder: (_) => const SplashScreen());
          case '/login':
            return MaterialPageRoute(builder: (_) => const LoginScreen());
          case '/register':
            return MaterialPageRoute(builder: (_) => const RegisterScreen());
          case '/home':
            return MaterialPageRoute(builder: (_) => const MainShell());
          case '/recipe-detail':
            if (settings.arguments is Map) {
              final args = settings.arguments as Map<String, dynamic>;
              return MaterialPageRoute(
                builder: (_) => RecipeDetailScreen(
                  recipeId: args['id'] as int,
                  missingIngredients: (args['missingIngredients'] as List?)?.cast<String>() ?? [],
                ),
              );
            }
            final recipeId = settings.arguments as int;
            return MaterialPageRoute(
              builder: (_) => RecipeDetailScreen(recipeId: recipeId),
            );
          case '/add-recipe':
            final recipe = settings.arguments as Recipe?;
            return MaterialPageRoute(
              builder: (_) => AddRecipeScreen(existingRecipe: recipe),
            );
          case '/my-recipes':
            return MaterialPageRoute(builder: (_) => const MyRecipesScreen());
          case '/favorites':
            return MaterialPageRoute(builder: (_) => const FavoritesScreen());
          case '/profile':
            return MaterialPageRoute(builder: (_) => const ProfileScreen());
          case '/user-profile':
            final userId = settings.arguments as int;
            return MaterialPageRoute(
              builder: (_) => UserProfileScreen(userId: userId),
            );
          case '/notifications':
            return MaterialPageRoute(builder: (_) => const NotificationsScreen());
          case '/admin':
            return MaterialPageRoute(builder: (_) => const AdminScreen());
          case '/admin-users':
            return MaterialPageRoute(builder: (_) => const AdminUsersScreen());
          case '/smart-search':
            return MaterialPageRoute(builder: (_) => const SmartSearchScreen());
          default:
            return MaterialPageRoute(builder: (_) => const SplashScreen());
        }
      },
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    HomeScreen(),
    FavoritesScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.favorite_outline),
            activeIcon: Icon(Icons.favorite),
            label: 'Favorites',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
