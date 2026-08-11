// lib/services/reference_cache_service.dart
// ─────────────────────────────────────────────────────────────
// Stale-while-revalidate cache for static reference data (regions,
// sectors, the MINEFOP service tree, ...). A cache hit is always
// returned immediately, regardless of staleness; once past its TTL,
// a fresh value is fetched in the background and silently kept on
// failure — offline reads just see the last-known value, never an
// error.
// ─────────────────────────────────────────────────────────────

import 'dart:async';

import 'package:hive_flutter/hive_flutter.dart';

class ReferenceCacheService {
  static const String boxName = 'referenceCacheBox';
  Box? _box;

  Future<Box> _openBox() async {
    _box ??= await Hive.openBox(boxName);
    return _box!;
  }

  /// Returns the cached value for [key] if present (regardless of
  /// staleness). If the entry is older than [ttl], also fires an
  /// unawaited background refresh via [fetch]. On a true cache miss,
  /// falls through to a live [fetch] — identical behavior to having no
  /// cache at all.
  Future<T> getCached<T>({
    required String key,
    required Duration ttl,
    required Future<T> Function() fetch,
  }) async {
    final box = await _openBox();
    final cached = box.get(key) as Map?;

    if (cached != null) {
      final fetchedAt = DateTime.parse(cached['fetchedAt'] as String);
      if (DateTime.now().difference(fetchedAt) > ttl) {
        // Fire-and-forget — never awaited, never throws into the caller.
        unawaited(_refreshInBackground(key, fetch, box));
      }
      return cached['value'] as T;
    }

    final value = await fetch();
    await box.put(key, {
      'value': value,
      'fetchedAt': DateTime.now().toIso8601String(),
    });
    return value;
  }

  /// Network-first with cache fallback — for time-sensitive gates (e.g. "is
  /// a submission period currently open") where getCached()'s
  /// return-stale-immediately behavior would wrongly block a real
  /// submission window as soon as one entity's device had ever cached a
  /// "closed" answer. Always attempts a live fetch first; the cache is
  /// only read when that fetch itself fails (offline), and is refreshed on
  /// every successful fetch.
  Future<T> getFresh<T>({
    required String key,
    required Future<T> Function() fetch,
  }) async {
    final box = await _openBox();
    try {
      final value = await fetch();
      await box.put(key, {
        'value': value,
        'fetchedAt': DateTime.now().toIso8601String(),
      });
      return value;
    } catch (_) {
      final cached = box.get(key) as Map?;
      if (cached == null) rethrow;
      return cached['value'] as T;
    }
  }

  Future<void> _refreshInBackground<T>(
    String key,
    Future<T> Function() fetch,
    Box box,
  ) async {
    try {
      final fresh = await fetch();
      await box.put(key, {
        'value': fresh,
        'fetchedAt': DateTime.now().toIso8601String(),
      });
    } catch (_) {
      // Silently keep the stale cache — by design, never surfaced.
    }
  }
}
