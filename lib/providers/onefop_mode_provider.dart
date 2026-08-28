// lib/providers/onefop_mode_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _kPrefsKey = 'onefop_view_mode';

/// Desktop-only Simple/Spreadsheet toggle for the ONEFOP form. Mobile has
/// no toggle and is always effectively "simple" — this provider only
/// governs which desktop shell renders (see
/// onefop_unified_form_screen_v4.dart's _desktopLayout()).
enum OnefopViewMode { simple, spreadsheet }

/// Mode state: defaults to spreadsheet (today's desktop experience,
/// unchanged for existing users), then corrects to the user's persisted
/// explicit choice, if any, once SharedPreferences resolves. Global/
/// device-level preference, not tied to a specific establishment —
/// mirrors locale_provider.dart's pattern.
class OnefopModeNotifier extends StateNotifier<OnefopViewMode> {
  OnefopModeNotifier() : super(OnefopViewMode.spreadsheet) {
    _restore();
  }

  Future<void> _restore() async {
    final saved = (await SharedPreferences.getInstance()).getString(_kPrefsKey);
    if (saved == 'simple') {
      state = OnefopViewMode.simple;
    } else if (saved == 'spreadsheet') {
      state = OnefopViewMode.spreadsheet;
    }
  }

  Future<void> setMode(OnefopViewMode mode) async {
    if (mode == state) return;
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPrefsKey, mode.name);
  }
}

final onefopModeProvider =
    StateNotifierProvider<OnefopModeNotifier, OnefopViewMode>(
  (ref) => OnefopModeNotifier(),
);
