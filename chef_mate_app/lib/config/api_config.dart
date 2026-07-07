import 'package:flutter/foundation.dart';

class ApiConfig {
  static String get baseUrl {
    if (kIsWeb) {
      // Chrome/web runs on the same machine
      return 'http://localhost:3001/api';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      // Use 10.0.2.2 for Android emulator
      // Change to your computer's IP for physical devices
      return 'http://10.0.2.2:3001/api';
    }
    // iOS simulator / desktop
    return 'http://localhost:3001/api';
  }

  static const Duration timeout = Duration(seconds: 30);
}
