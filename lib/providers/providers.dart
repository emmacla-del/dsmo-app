import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(); // ✅ No arguments – baseUrl is auto-detected (web: localhost, Android: 10.0.2.2)
});
