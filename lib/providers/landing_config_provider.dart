// lib/providers/landing_config_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../data/api_client.dart';
import '../models/landing_config.dart';
import '../services/reference_cache_service.dart';

/// The landing page's Super-Admin-editable content. Never surfaces as an
/// AsyncError — any failure (offline, 404, malformed body) resolves to
/// [LandingConfig.defaults], so callers can just read `.value` without
/// handling a loading/error branch for what is, from the UI's
/// perspective, purely cosmetic content.
final landingConfigProvider = FutureProvider<LandingConfig>((ref) async {
  try {
    final json = await ref.read(apiClientProvider).getLandingConfig();
    return LandingConfig.fromJson(json);
  } catch (_) {
    return LandingConfig.defaults();
  }
});

/// Best-effort synchronous read of the last successfully-fetched config,
/// used only to fill the gap while [landingConfigProvider]'s network call
/// (deliberately network-first — see ApiClient.getLandingConfig) is still
/// in flight. Without this, a returning visitor briefly sees
/// [LandingConfig.defaults] flash before their real, already-cached config
/// replaces it a moment later.
///
/// Returns null on a genuine first-ever load (nothing cached yet), if the
/// Hive box isn't open yet, or on any unexpected shape — callers fall back
/// to [LandingConfig.defaults] exactly as before this existed.
LandingConfig? peekCachedLandingConfig() {
  if (!Hive.isBoxOpen(ReferenceCacheService.boxName)) return null;
  try {
    final box = Hive.box(ReferenceCacheService.boxName);
    final cached = box.get(ApiClient.landingConfigCacheKey) as Map?;
    if (cached == null) return null;
    final value = Map<String, dynamic>.from(cached['value'] as Map);
    return LandingConfig.fromJson(value);
  } catch (_) {
    return null;
  }
}
