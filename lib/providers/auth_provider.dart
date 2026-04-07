import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../models/user.dart';

final authProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(api);
});

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final ApiClient _api;
  AuthNotifier(this._api) : super(const AsyncValue.data(null));

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final response = await _api
          .post('/auth/login', data: {'email': email, 'password': password});
      final token = response.data['access_token'];
      await _api.setToken(token);
      final user = User.fromJson(response.data['user']);
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> logout() async {
    await _api.setToken('');
    state = const AsyncValue.data(null);
  }

  Future<void> register(String email, String password, String role,
      {String? region, String? department}) async {
    state = const AsyncValue.loading();
    try {
      await _api.post('/auth/register', data: {
        'email': email,
        'password': password,
        'role': role,
        'region': region,
        'department': department,
      });
      // After registration, log in automatically
      await login(email, password);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
}
