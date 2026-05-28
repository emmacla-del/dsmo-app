// lib/providers/auth_provider.dart
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

  AuthNotifier(this._api) : super(const AsyncValue.loading()) {
    _tryRestore();
  }

  Future<void> _tryRestore() async {
    // Wake Render server immediately — fire and forget so it's warm by login time
    _api.get('/health').catchError((_) {});

    try {
      final token = await _api.getStoredToken();
      if (token == null || token.isEmpty) {
        state = const AsyncValue.data(null);
        return;
      }
      final response = await _api.get('/auth/me');
      final user = User.fromJson(response.data as Map<String, dynamic>);
      state = AsyncValue.data(user);
    } catch (_) {
      await _api.logout();
      state = const AsyncValue.data(null);
    }
  }

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
    await _api.logout();
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

      if (role != 'COMPANY') {
        state = const AsyncValue.data(null);
        return;
      }

      final token = response.data['access_token'] as String?;
      if (token == null) throw 'Aucun token reçu après inscription.';
      await _api.setToken(token);
      final user = User.fromJson(response.data['user'] as Map<String, dynamic>);
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> registerCompany({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String role,
    String? region,
    String? department,
    required String companyName,
    required String taxNumber,
    required String mainActivity,
    required String address,
    String? parentCompany,
    String? secondaryActivity,
    String? cnpsNumber,
    String? fax,
    int? socialCapital,
    String? subdivision,
    String? entityType,
    String? area,
    String? sectorId,
    String? phone,
    String? phone2,
    String? poBox,
    String? legalStatus,
    String? cooperativeType,
    String? ctdType,
    String? yearOfCreation,
    String? mainMission,
    String? registrationNumber,
    String? trainingDomains,
    String? respondentPhone,
    String? respondentPhone2,
    String? respondentFunction,
    String? respondentFirstName,
    String? respondentLastName,
    String? branch,
  }) async {
    if (state is AsyncLoading) return;
    state = const AsyncValue.loading();
    try {
      final response = await _api.post('/auth/register-company', data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'role': role,
        if (region != null) 'region': region,
        if (department != null) 'department': department,
        'companyName': companyName,
        'taxNumber': taxNumber,
        'mainActivity': mainActivity,
        'address': address,
        if (parentCompany != null) 'parentCompany': parentCompany,
        if (secondaryActivity != null) 'secondaryActivity': secondaryActivity,
        if (cnpsNumber != null) 'cnpsNumber': cnpsNumber,
        if (fax != null) 'fax': fax,
        if (socialCapital != null) 'socialCapital': socialCapital,
        if (subdivision != null) 'subdivision': subdivision,
        if (entityType != null) 'entityType': entityType,
        if (area != null) 'area': area,
        if (sectorId != null) 'sectorId': sectorId,
        if (phone != null) 'phone': phone,
        if (phone2 != null) 'phone2': phone2,
        if (poBox != null) 'poBox': poBox,
        if (legalStatus != null) 'legalStatus': legalStatus,
        if (cooperativeType != null) 'cooperativeType': cooperativeType,
        if (ctdType != null) 'ctdType': ctdType,
        if (yearOfCreation != null) 'yearOfCreation': yearOfCreation,
        if (mainMission != null) 'mainMission': mainMission,
        if (registrationNumber != null)
          'registrationNumber': registrationNumber,
        if (trainingDomains != null) 'trainingDomains': trainingDomains,
        if (respondentPhone != null) 'respondentPhone': respondentPhone,
        if (respondentPhone2 != null) 'respondentPhone2': respondentPhone2,
        if (respondentFunction != null)
          'respondentFunction': respondentFunction,
        if (respondentFirstName != null)
          'respondentFirstName': respondentFirstName,
        if (respondentLastName != null)
          'respondentLastName': respondentLastName,
        if (branch != null) 'branch': branch,
      });

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
