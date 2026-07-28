// lib/widgets/file_saver.dart
// ─────────────────────────────────────────────────────────────
// Unified "save bytes as a downloaded file" export — resolves
// platform automatically, mirroring pdf_viewer_screen.dart.
// ─────────────────────────────────────────────────────────────

export 'file_saver_mobile.dart' if (dart.library.html) 'file_saver_web.dart';
