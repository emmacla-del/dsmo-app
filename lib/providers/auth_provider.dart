// lib/providers/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../models/user.dart';

final authProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  final api = ref.read(apiClientProvider);
  return AuthNotifier(api, ref);
});

/// Set by AuthNotifier._doLogin when the backend responds with
/// `requiresTwoFactor` instead of an access token. Holds the short-lived
/// challenge token that verifyTwoFactorCode() submits alongside the
/// emailed code. Null when no 2FA challenge is in progress.
final twoFactorChallengeProvider = StateProvider<String?>((ref) => null);

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final ApiClient _api;
  final Ref _ref;

  // The "Rester connecté" choice from the login attempt that's currently
  // in progress. A 2FA challenge splits one login into two requests
  // (password, then emailed code) with twoFactorChallengeProvider carrying
  // state between them — this carries the remember choice the same way so
  // verifyTwoFactorCode() can honor it too.
  bool _pendingRemember = true;

  AuthNotifier(this._api, this._ref) : super(const AsyncValue.loading()) {
    _tryRestore();
  }

  Future<void> _tryRestore() async {
    // Wake Render server immediately — fire and forget so it's warm by login time.
    // Use a proper try/catch instead of .catchError() to avoid the
    // "handler must return Future's type" DartError on web/DDC.
    _warmServer();

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

  /// Fire-and-forget ping to wake the Render free-tier server.
  /// Errors are silently swallowed — this is best-effort only.
  Future<void> _warmServer() async {
    try {
      await _api.get('/health');
    } catch (_) {
      // Intentionally ignored — server may still be cold-starting.
    }
  }

  /// Re-fetches /auth/me and replaces the cached user in place. The cached
  /// user is otherwise only set at login/register/2FA and never touched
  /// again for the rest of the session, so server-computed fields on it
  /// (e.g. onefopSubmissionStatus) go stale the moment something changes
  /// server-side — call this after actions like a form submission so
  /// screens reading `user.features` reflect the new state without
  /// forcing a full logout/login.
  Future<void> refreshUser() async {
    try {
      final response = await _api.get('/auth/me');
      state = AsyncValue.data(User.fromJson(response.data as Map<String, dynamic>));
    } catch (_) {
      // Best-effort — keep the existing cached user on failure.
    }
  }

  Future<void> login(String email, String password, {bool remember = true}) async {
    if (state is AsyncLoading) return;
    state = const AsyncValue.loading();
    await _doLogin(email, password, remember: remember);
  }

  Future<void> _doLogin(String email, String password, {bool remember = true}) async {
    _pendingRemember = remember;
    try {
      final response = await _api.post(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      if (response.data['requiresTwoFactor'] == true) {
        _ref.read(twoFactorChallengeProvider.notifier).state =
            response.data['challengeToken'] as String;
        state = const AsyncValue.data(null);
        return;
      }
      final token = response.data['access_token'];
      await _api.setToken(token, persist: remember);
      final user = User.fromJson(response.data['user']);
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// Completes a 2FA login: submits the emailed code alongside the
  /// challengeToken stashed by _doLogin. On success, behaves exactly like
  /// a normal login (sets the token and the authenticated user state).
  Future<void> verifyTwoFactorCode(String code) async {
    final challengeToken = _ref.read(twoFactorChallengeProvider);
    if (challengeToken == null) return;
    state = const AsyncValue.loading();
    try {
      final response = await _api.post(
        '/auth/2fa/verify',
        data: {'challengeToken': challengeToken, 'code': code},
      );
      final token = response.data['access_token'];
      await _api.setToken(token, persist: _pendingRemember);
      final user = User.fromJson(response.data['user']);
      _ref.read(twoFactorChallengeProvider.notifier).state = null;
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// Abandons a pending 2FA challenge and returns to the login form.
  void cancelTwoFactorChallenge() {
    _ref.read(twoFactorChallengeProvider.notifier).state = null;
    state = const AsyncValue.data(null);
  }

  /// Updates the caller's notification preferences. Email is the only
  /// channel actually wired to a sender today — push/SMS are persisted
  /// as real per-user state but not yet delivered anywhere.
  Future<void> updateNotificationPreferences({
    bool? emailNotificationsEnabled,
    bool? pushNotificationsEnabled,
    bool? weeklyDigestEnabled,
    bool? smsNotificationsEnabled,
  }) async {
    final response = await _api.patch('/auth/preferences', data: {
      if (emailNotificationsEnabled != null)
        'emailNotificationsEnabled': emailNotificationsEnabled,
      if (pushNotificationsEnabled != null)
        'pushNotificationsEnabled': pushNotificationsEnabled,
      if (weeklyDigestEnabled != null) 'weeklyDigestEnabled': weeklyDigestEnabled,
      if (smsNotificationsEnabled != null)
        'smsNotificationsEnabled': smsNotificationsEnabled,
    });
    state = AsyncValue.data(User.fromJson(response.data as Map<String, dynamic>));
  }

  /// Enables/disables email-OTP 2FA at login.
  Future<void> setTwoFactorEnabled(bool enabled) async {
    final response =
        await _api.patch('/auth/two-factor', data: {'enabled': enabled});
    state = AsyncValue.data(User.fromJson(response.data as Map<String, dynamic>));
  }

  Future<void> logout() async {
    await _api.logout();
    state = const AsyncValue.data(null);
  }

  /// Requests a password reset email. Does not touch [state] — this is
  /// unrelated to the current session. Throws [ApiException] on failure.
  Future<String> forgotPassword(String email) async {
    final response = await _api.post(
      '/auth/forgot-password',
      data: {'email': email},
    );
    return response.data['message'] as String;
  }

  /// Completes a password reset using the token emailed to the user.
  /// Does not touch [state] — the user still has to log in afterwards.
  Future<String> resetPassword(String token, String newPassword) async {
    final response = await _api.post(
      '/auth/reset-password',
      data: {'token': token, 'newPassword': newPassword},
    );
    return response.data['message'] as String;
  }

  /// Changes the current user's password (voluntary, or to clear a
  /// mustChangePassword flag after an admin-issued temporary password).
  /// On success, clears mustChangePassword on the in-memory user so the
  /// app doesn't keep treating the session as needing a forced change.
  Future<String> changePassword(
      String currentPassword, String newPassword) async {
    final response = await _api.patch(
      '/auth/change-password',
      data: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    final current = state.value;
    if (current != null) {
      state = AsyncValue.data(current.copyWith(mustChangePassword: false));
    }
    return response.data['message'] as String;
  }

  /// Confirms an email address using the token emailed at signup.
  Future<String> verifyEmail(String token) async {
    final response = await _api.post(
      '/auth/verify-email',
      data: {'token': token},
    );
    return response.data['message'] as String;
  }

  /// Re-sends the verification email to the currently logged-in user.
  Future<String> resendVerificationEmail() async {
    final response = await _api.post('/auth/resend-verification');
    return response.data['message'] as String;
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
