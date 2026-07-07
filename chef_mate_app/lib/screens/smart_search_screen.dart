import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../providers/recipe_provider.dart';
import '../widgets/empty_state.dart';

class SmartSearchScreen extends StatefulWidget {
  const SmartSearchScreen({super.key});
  @override
  State<SmartSearchScreen> createState() => _SmartSearchScreenState();
}

class _SmartSearchScreenState extends State<SmartSearchScreen> {
  final _picker = ImagePicker();
  final _textController = TextEditingController();
  bool _showInput = false;
  bool _showResults = false;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RecipeProvider>().clearSmartSearch();
    });
  }

  Future<void> _pickImage(ImageSource source) async {
    final xFile = await _picker.pickImage(source: source, maxWidth: 1024);
    if (xFile == null) return;
    final bytes = await xFile.readAsBytes();
    if (!mounted) return;
    await context.read<RecipeProvider>().scanAndSearch(bytes);
    setState(() => _showInput = true);
  }

  void _addIngredient(String text) {
    if (text.trim().isEmpty) return;
    final rp = context.read<RecipeProvider>();
    final list = [...rp.identifiedIngredients, text.trim()];
    rp.updateIdentifiedIngredients(list);
    _textController.clear();
  }

  void _removeIngredient(int index) {
    final rp = context.read<RecipeProvider>();
    final list = [...rp.identifiedIngredients];
    list.removeAt(index);
    rp.updateIdentifiedIngredients(list);
    if (list.isEmpty) setState(() => _showInput = false);
  }

  Future<void> _search() async {
    final rp = context.read<RecipeProvider>();
    if (rp.identifiedIngredients.isEmpty) return;
    await rp.searchByIngredients(rp.identifiedIngredients);
    setState(() => _showResults = true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Smart Search')),
      body: Consumer<RecipeProvider>(
        builder: (_, rp, __) {
          if (rp.isLoading && !_showInput && !_showResults) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('AI is analyzing your image...'),
                ],
              ),
            );
          }

          if (rp.isLoading && _showInput && !_showResults) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Searching for recipes...'),
                ],
              ),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!_showInput) _buildInputOptions(),
                if (_showInput && !_showResults && rp.error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(rp.error!, style: const TextStyle(color: Colors.red, fontSize: 14)),
                  ),
                if (_showInput && !_showResults) _buildIngredientChips(rp),
                if (_showResults) _buildResults(rp),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInputOptions() {
    return Column(
      children: [
        const SizedBox(height: 40),
        const Text('What are you cooking with?',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Take a photo or type ingredients',
          style: TextStyle(color: AppTheme.textSecondary)),
        const SizedBox(height: 32),
        _optionCard(
          icon: Icons.camera_alt,
          title: 'Take a photo',
          subtitle: 'Snap your ingredients',
          onTap: () => _pickImage(ImageSource.camera),
        ),
        const SizedBox(height: 16),
        _optionCard(
          icon: Icons.photo_library,
          title: 'Pick from gallery',
          subtitle: 'Choose an existing photo',
          onTap: () => _pickImage(ImageSource.gallery),
        ),
        const SizedBox(height: 16),
        _optionCard(
          icon: Icons.keyboard,
          title: 'Type ingredients',
          subtitle: 'Enter them manually',
          onTap: () => setState(() => _showInput = true),
        ),
      ],
    );
  }

  Widget _optionCard({required IconData icon, required String title, required String subtitle, required VoidCallback onTap}) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.1),
          child: Icon(icon, color: AppTheme.primaryColor),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }

  Widget _buildIngredientChips(RecipeProvider rp) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        if (rp.identifiedIngredients.isEmpty && rp.error == null)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text('No ingredients detected. Enter them manually below.',
              style: TextStyle(color: AppTheme.textSecondary)),
          ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ...rp.identifiedIngredients.asMap().entries.map((e) =>
              Chip(
                label: Text(e.value),
                deleteIcon: const Icon(Icons.close, size: 18),
                onDeleted: () => _removeIngredient(e.key),
                backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.1),
              ),
            ),
            ActionChip(
              avatar: const Icon(Icons.add, size: 18),
              label: Text(
                rp.identifiedIngredients.isEmpty ? 'Add ingredient' : 'Add more',
                style: const TextStyle(fontSize: 13),
              ),
              onPressed: () {
                if (_textController.text.isNotEmpty) {
                  _addIngredient(_textController.text);
                }
              },
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 44,
          child: TextField(
            controller: _textController,
            decoration: InputDecoration(
              hintText: 'Type an ingredient...',
              suffixIcon: IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: () => _addIngredient(_textController.text),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onSubmitted: _addIngredient,
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: rp.identifiedIngredients.isNotEmpty ? _search : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Find Recipes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

  Widget _buildResults(RecipeProvider rp) {
    if (rp.isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.only(top: 60),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (rp.smartResults.isEmpty) {
      return EmptyState(
        icon: Icons.search_off,
        title: 'No matching recipes',
        subtitle: 'Try different ingredients',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Text('Found ${rp.smartResults.length} matching recipes',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8, runSpacing: 6,
          children: rp.identifiedIngredients.map((i) =>
            Chip(
              label: Text(i, style: const TextStyle(fontSize: 12)),
              visualDensity: VisualDensity.compact,
              backgroundColor: AppTheme.accentGreen.withValues(alpha: 0.1),
            ),
          ).toList(),
        ),
        const SizedBox(height: 16),
        ...rp.smartResults.map((r) => _buildResultCard(r, rp)),
      ],
    );
  }

  Widget _buildResultCard(Map<String, dynamic> json, RecipeProvider rp) {
    final matchScore = (json['matchScore'] as num?)?.toDouble() ?? 0;
    final missing = (json['missingIngredients'] as List?)?.cast<String>() ?? [];
    final color = matchScore >= 0.8 ? AppTheme.accentGreen
        : matchScore >= 0.5 ? AppTheme.accentOrange
        : AppTheme.textSecondary;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).pushNamed('/recipe-detail', arguments: json['id']),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Stack(
                children: [
                  Container(
                    width: 80, height: 80,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: const LinearGradient(
                        colors: [AppTheme.gradientStart, AppTheme.gradientEnd],
                      ),
                    ),
                    child: const Center(
                      child: Icon(Icons.restaurant, color: Colors.white54, size: 32),
                    ),
                  ),
                  Positioned(
                    top: 4, right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text('${(matchScore * 100).round()}%',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(json['title']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text('⏱ ${(json['prep_time'] ?? 0) + (json['cook_time'] ?? 0)} min',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                    if (missing.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text('Missing: ${missing.take(3).join(", ")}${missing.length > 3 ? "..." : ""}',
                        style: TextStyle(fontSize: 11, color: color)),
                    ] else
                      const Text('✅ You have all ingredients!',
                        style: TextStyle(fontSize: 11, color: AppTheme.accentGreen)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
