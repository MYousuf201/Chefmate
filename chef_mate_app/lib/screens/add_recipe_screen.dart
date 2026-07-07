import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/recipe.dart';
import '../providers/recipe_provider.dart';
import '../config/theme.dart';

class AddRecipeScreen extends StatefulWidget {
  final Recipe? existingRecipe;

  const AddRecipeScreen({super.key, this.existingRecipe});

  @override
  State<AddRecipeScreen> createState() => _AddRecipeScreenState();
}

class _AddRecipeScreenState extends State<AddRecipeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _cuisineController = TextEditingController();
  final _prepTimeController = TextEditingController();
  final _cookTimeController = TextEditingController();
  final _servingsController = TextEditingController();
  final _imageUrlController = TextEditingController();

  final List<TextEditingController> _ingredientControllers = [TextEditingController()];
  final List<TextEditingController> _instructionControllers = [TextEditingController()];

  String _difficulty = 'easy';

  bool get _isEditing => widget.existingRecipe != null;

  @override
  void initState() {
    super.initState();
    if (widget.existingRecipe != null) {
      final r = widget.existingRecipe!;
      _titleController.text = r.title;
      _descriptionController.text = r.description ?? '';
      _cuisineController.text = r.cuisine ?? '';
      _prepTimeController.text = r.prepTime.toString();
      _cookTimeController.text = r.cookTime.toString();
      _servingsController.text = r.servings.toString();
      _imageUrlController.text = r.imageUrl ?? '';
      _difficulty = r.difficulty;
      _ingredientControllers.clear();
      for (final ing in r.ingredients) {
        _ingredientControllers.add(TextEditingController(text: ing));
      }
      _instructionControllers.clear();
      for (final inst in r.instructions) {
        _instructionControllers.add(TextEditingController(text: inst));
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _cuisineController.dispose();
    _prepTimeController.dispose();
    _cookTimeController.dispose();
    _servingsController.dispose();
    _imageUrlController.dispose();
    for (final c in _ingredientControllers) c.dispose();
    for (final c in _instructionControllers) c.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final data = {
      'title': _titleController.text.trim(),
      'description': _descriptionController.text.trim(),
      'cuisine': _cuisineController.text.trim(),
      'prep_time': int.tryParse(_prepTimeController.text) ?? 0,
      'cook_time': int.tryParse(_cookTimeController.text) ?? 0,
      'servings': int.tryParse(_servingsController.text) ?? 1,
      'difficulty': _difficulty,
      'image_url': _imageUrlController.text.trim().isNotEmpty ? _imageUrlController.text.trim() : null,
      'ingredients': _ingredientControllers.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList(),
      'instructions': _instructionControllers.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList(),
    };

    final rp = context.read<RecipeProvider>();
    bool success;
    if (_isEditing) {
      success = await rp.updateRecipe(widget.existingRecipe!.id, data);
    } else {
      success = await rp.createRecipe(data);
    }

    if (!mounted) return;
    if (success) {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Edit Recipe' : 'Add Recipe')),
      body: Consumer<RecipeProvider>(
        builder: (_, rp, __) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (rp.error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(rp.error!, style: const TextStyle(color: Colors.red)),
                  ),
                TextFormField(controller: _titleController, decoration: const InputDecoration(labelText: 'Recipe Title'),
                    validator: (v) => v == null || v.isEmpty ? 'Required' : null),
                const SizedBox(height: 12),
                TextFormField(controller: _descriptionController, decoration: const InputDecoration(labelText: 'Description'), maxLines: 3),
                const SizedBox(height: 12),
                TextFormField(controller: _cuisineController, decoration: const InputDecoration(labelText: 'Cuisine')),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: TextFormField(controller: _prepTimeController, decoration: const InputDecoration(labelText: 'Prep Time (min)'), keyboardType: TextInputType.number)),
                    const SizedBox(width: 12),
                    Expanded(child: TextFormField(controller: _cookTimeController, decoration: const InputDecoration(labelText: 'Cook Time (min)'), keyboardType: TextInputType.number)),
                    const SizedBox(width: 12),
                    Expanded(child: TextFormField(controller: _servingsController, decoration: const InputDecoration(labelText: 'Servings'), keyboardType: TextInputType.number)),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _difficulty,
                  decoration: const InputDecoration(labelText: 'Difficulty'),
                  items: ['easy', 'medium', 'hard'].map((d) => DropdownMenuItem(value: d, child: Text(d[0].toUpperCase() + d.substring(1)))).toList(),
                  onChanged: (v) => setState(() => _difficulty = v!),
                ),
                const SizedBox(height: 12),
                TextFormField(controller: _imageUrlController, decoration: const InputDecoration(labelText: 'Image URL (optional)')),
                const SizedBox(height: 20),
                _buildListSection('Ingredients', _ingredientControllers, () {
                  setState(() => _ingredientControllers.add(TextEditingController()));
                }),
                const SizedBox(height: 20),
                _buildListSection('Instructions', _instructionControllers, () {
                  setState(() => _instructionControllers.add(TextEditingController()));
                }),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: rp.isLoading ? null : _save,
                  child: rp.isLoading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(_isEditing ? 'Update Recipe' : 'Create Recipe', style: const TextStyle(fontSize: 16)),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildListSection(String label, List<TextEditingController> controllers, VoidCallback onAdd) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Spacer(),
            IconButton(icon: const Icon(Icons.add_circle, color: AppTheme.primaryColor), onPressed: onAdd),
          ],
        ),
        ...controllers.asMap().entries.map((entry) {
          final i = entry.key;
          final c = entry.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: c,
                    decoration: InputDecoration(
                      hintText: '${label.substring(0, label.length - 1)} ${i + 1}',
                      border: const OutlineInputBorder(),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                  ),
                ),
                if (controllers.length > 1)
                  IconButton(
                    icon: const Icon(Icons.remove_circle, color: Colors.red),
                    onPressed: () {
                      c.dispose();
                      setState(() => controllers.removeAt(i));
                    },
                  ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
