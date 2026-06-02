// lib/services/draft_service.dart
// ─────────────────────────────────────────────────────────────
// Persistent draft storage for ONEFOP forms using SharedPreferences.
// Supports both COMPANY (establishmentId+quarterCode) and
// ADMIN (userId+entityType) draft keys.
// ─────────────────────────────────────────────────────────────

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class DraftService {
  static const String _prefix = 'onefop_draft_';
  static const String _timestampSuffix = '_ts';
  static const int _maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Generate storage key based on available parameters
  static String _getStorageKey({
    String? establishmentId,
    String? quarterCode,
    String? userId,
    String? entityType,
  }) {
    if (establishmentId != null && quarterCode != null) {
      return '${_prefix}est_${establishmentId}_$quarterCode';
    }
    if (userId != null && entityType != null) {
      return '${_prefix}user_${userId}_$entityType';
    }
    throw ArgumentError(
        'Either (establishmentId+quarterCode) or (userId+entityType) must be provided');
  }

  static String _getTimestampKey(String storageKey) =>
      '$storageKey$_timestampSuffix';

  /// Save draft data persistently. Strips empty/null values to keep storage lean.
  static Future<void> saveDraft({
    String? establishmentId,
    String? quarterCode,
    String? userId,
    String? entityType,
    required Map<String, dynamic> data,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getStorageKey(
      establishmentId: establishmentId,
      quarterCode: quarterCode,
      userId: userId,
      entityType: entityType,
    );

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
        _getTimestampKey(key), DateTime.now().millisecondsSinceEpoch);
  }

  /// Load draft if it exists and is not expired.
  static Future<Map<String, dynamic>?> loadDraft({
    String? establishmentId,
    String? quarterCode,
    String? userId,
    String? entityType,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getStorageKey(
      establishmentId: establishmentId,
      quarterCode: quarterCode,
      userId: userId,
      entityType: entityType,
    );

    final json = prefs.getString(key);
    if (json == null) return null;

    // Check expiry
    final timestamp = prefs.getInt(_getTimestampKey(key));
    if (timestamp != null) {
      final age = DateTime.now().millisecondsSinceEpoch - timestamp;
      if (age > _maxAgeMs) {
        await clearDraft(
          establishmentId: establishmentId,
          quarterCode: quarterCode,
          userId: userId,
          entityType: entityType,
        );
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
    String? establishmentId,
    String? quarterCode,
    String? userId,
    String? entityType,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getStorageKey(
      establishmentId: establishmentId,
      quarterCode: quarterCode,
      userId: userId,
      entityType: entityType,
    );
    await prefs.remove(key);
    await prefs.remove(_getTimestampKey(key));
  }

  /// Check if a draft exists (for showing resume prompts / badges).
  static Future<bool> hasDraft({
    String? establishmentId,
    String? quarterCode,
    String? userId,
    String? entityType,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getStorageKey(
      establishmentId: establishmentId,
      quarterCode: quarterCode,
      userId: userId,
      entityType: entityType,
    );
    return prefs.containsKey(key);
  }
}
