import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';

final emailAvailabilityProvider =
    FutureProvider.autoDispose.family<bool, String>((ref, email) async {
  if (email.trim().isEmpty) return true;

  final link = ref.keepAlive();

  final api = ref.read(apiClientProvider);
  try {
    final response =
        await api.get('/auth/check-email', queryParameters: {'email': email});
    final nested = response.data['available'] as Map<String, dynamic>;
    final isAvailable = nested['available'] as bool;

    return isAvailable;
  } catch (e) {
    return false;
  } finally {
    link.close();
  }
});
