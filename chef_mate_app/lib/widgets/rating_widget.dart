import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import '../config/theme.dart';

class StarRatingWidget extends StatelessWidget {
  final double rating;
  final double size;
  final bool showCount;
  final int? count;

  const StarRatingWidget({
    super.key,
    required this.rating,
    this.size = 16,
    this.showCount = false,
    this.count,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        RatingBarIndicator(
          rating: rating,
          itemBuilder: (_, __) => const Icon(Icons.star, color: Colors.amber),
          itemCount: 5,
          itemSize: size,
          direction: Axis.horizontal,
        ),
        if (showCount && count != null) ...[
          const SizedBox(width: 4),
          Text('($count)', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
        ],
      ],
    );
  }
}

class RatingInputWidget extends StatelessWidget {
  final double rating;
  final ValueChanged<double> onRatingUpdate;
  final double itemSize;

  const RatingInputWidget({
    super.key,
    required this.rating,
    required this.onRatingUpdate,
    this.itemSize = 32,
  });

  @override
  Widget build(BuildContext context) {
    return RatingBar(
      ratingWidget: RatingWidget(
        full: const Icon(Icons.star, color: Colors.amber),
        half: const Icon(Icons.star_half, color: Colors.amber),
        empty: const Icon(Icons.star_outline, color: Colors.amber),
      ),
      initialRating: rating,
      onRatingUpdate: onRatingUpdate,
      itemSize: itemSize,
      itemCount: 5,
      direction: Axis.horizontal,
    );
  }
}
