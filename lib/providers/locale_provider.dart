// lib/providers/locale_provider.dart
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const List<Locale> kSupportedLocales = [Locale('fr'), Locale('en')];
const String _kPrefsKey = 'app_locale';

/// Locale state: defaults to the device locale (falling back to French for
/// anything other than 'en'/'fr'), then corrects to the user's persisted
/// explicit choice, if any, once SharedPreferences resolves.
class LocaleNotifier extends StateNotifier<Locale> {
  LocaleNotifier() : super(_deviceDefault()) {
    _restore();
  }

  static Locale _deviceDefault() {
    final code = WidgetsBinding.instance.platformDispatcher.locale.languageCode;
    return code == 'en' ? const Locale('en') : const Locale('fr');
  }

  Future<void> _restore() async {
    final saved = (await SharedPreferences.getInstance()).getString(_kPrefsKey);
    if (saved == 'en' || saved == 'fr') {
      state = Locale(saved!);
    }
  }

  Future<void> setLocale(Locale locale) async {
    if (locale == state) return;
    state = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPrefsKey, locale.languageCode);
  }
}

final localeProvider = StateNotifierProvider<LocaleNotifier, Locale>(
  (ref) => LocaleNotifier(),
);
