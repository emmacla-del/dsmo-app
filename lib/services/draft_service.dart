// lib/services/draft_service.dart
// ─────────────────────────────────────────────────────────────
// Persistent draft storage for ONEFOP forms using SharedPreferences.
// Each user+entityType combination gets its own draft slot with expiry.
// ─────────────────────────────────────────────────────────────

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class DraftService {
  static const String _prefix = 'onefop_draft_';
  static const String _timestampSuffix = '_ts';
  static const int _maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  /// Save draft data persistently. Strips empty/null values to keep storage lean.
  static Future<void> saveDraft({
    required String userId,
    required String entityType,
    required Map<String, dynamic> data,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final key = '$_prefix${userId}_$entityType';

    final cleanData = Map<String, dynamic>.fromEntries(
      data.entries.where((e) {
        final v = e.value;
        if (v == null) return false;
        if (v is String && v.trim().isEmpty) return false;
        if (v is int && v == 0) return false;
        return true;
      }),
    );

    await prefs.setString(key, jsonEncode(cleanData));
    await prefs.setInt(
        '$key$_timestampSuffix', DateTime.now().millisecondsSinceEpoch);
  }

  /// Load draft if it exists and is not expired.
  static Future<Map<String, dynamic>?> loadDraft({
    required String userId,
    required String entityType,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final key = '$_prefix${userId}_$entityType';
    final json = prefs.getString(key);
    if (json == null) return null;

    // Check expiry
    final timestamp = prefs.getInt('$key$_timestampSuffix');
    if (timestamp != null) {
      final age = DateTime.now().millisecondsSinceEpoch - timestamp;
      if (age > _maxAgeMs) {
        await clearDraft(userId: userId, entityType: entityType);
        return null;
      }
    }

    try {
      final decoded = jsonDecode(json) as Map<String, dynamic>;
      return decoded;
    } catch (_) {
      return null;
    }
  }

  /// Clear draft after successful submission or when user discards it.
  static Future<void> clearDraft({
    required String userId,
    required String entityType,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final key = '$_prefix${userId}_$entityType';
    await prefs.remove(key);
    await prefs.remove('$key$_timestampSuffix');
  }

  /// Check if a draft exists (for showing resume prompts / badges).
  static Future<bool> hasDraft({
    required String userId,
    required String entityType,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey('$_prefix${userId}_$entityType');
  }
}
