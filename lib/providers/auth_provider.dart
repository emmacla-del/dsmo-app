import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../models/user.dart';

final authProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  final api = ref.read(apiClientProvider);
  return AuthNotifier(api);
});

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final ApiClient _api;
  AuthNotifier(this._api) : super(const AsyncValue.data(null));

  Future<void> login(String email, String password) async {
    if (state is AsyncLoading) return;
    state = const AsyncValue.loading();
    await _doLogin(email, password);
  }

  Future<void> _doLogin(String email, String password) async {
    try {
      final response = await _api.post(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
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

  Future<void> register(
    String email,
    String password,
    String firstName,
    String lastName,
    String role, {
    String? region,
    String? department,
    String? matricule,
    String? poste,
    String? serviceCode,
  }) async {
    if (state is AsyncLoading) return;
    state = const AsyncValue.loading();
    try {
      final response = await _api.post('/auth/register', data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'role': role,
        if (region != null) 'region': region,
        if (department != null) 'department': department,
        if (matricule != null) 'matricule': matricule,
        if (poste != null) 'poste': poste,
        if (serviceCode != null) 'serviceCode': serviceCode,
      });

      // ✅ For MINEFOP users (role != 'COMPANY'), do NOT auto-login
      if (role != 'COMPANY') {
        // Clear loading state without storing token or user
        state = const AsyncValue.data(null);
        return;
      }

      // For companies, auto-login as before
      final token = response.data['access_token'] as String?;
      if (token == null) throw 'Aucun token reçu après inscription.';
      await _api.setToken(token);
      final user = User.fromJson(response.data['user'] as Map<String, dynamic>);
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
}
