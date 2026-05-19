// lib/widgets/pdf_viewer_screen.dart
// ─────────────────────────────────────────────────────────────
// Unified PDF viewer export — resolves platform automatically.
// ─────────────────────────────────────────────────────────────

export 'pdf_cache.dart';
export 'pdf_viewer_screen_mobile.dart'
    if (dart.library.html) 'pdf_viewer_screen_web.dart';
