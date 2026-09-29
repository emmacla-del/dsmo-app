// Loads the app's real font (Inter) before golden-capture tests run, so
// visual-audit screenshots (onefop_form_screenshot_test.dart) show actual
// text instead of the default test tofu-box placeholder glyph. Not needed
// for non-visual tests, but harmless — flutter_test_config.dart applies to
// every test in this directory tree.
import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart' show AssetImage, ImageConfiguration, ImageStreamListener;
import 'package:flutter/services.dart' show EventChannel, FontLoader, MethodChannel, rootBundle;
import 'package:flutter/widgets.dart' show EditableText;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  // The blinking text-caret in any focused field is time-driven, not
  // frame-driven — a golden capture can land on either phase of the blink
  // depending on real wall-clock timing (worse under CPU contention from
  // other parallel test processes), making an otherwise-identical render
  // fail or pass at random. This freezes it to always-on for every test in
  // the suite, matching how WidgetTester itself recommends handling caret
  // blink in golden tests.
  EditableText.debugDeterministicCursor = true;
  // OnefopModeNotifier (onefop_mode_provider.dart) reads SharedPreferences
  // on construction — without a mock backend, every widget test that
  // touches onefopModeProvider (which OnefopUnifiedFormScreenV4 always
  // does) throws MissingPluginException before it can even pump. Reset
  // per-test (not just once for the whole file): OnefopModeNotifier.setMode
  // persists the choice via prefs.setString, and the mock backend is a
  // single process-wide store — without this reset, one test picking
  // Simple Mode leaks into every test that runs after it in the same file,
  // silently switching them to a mode they never asked for.
  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() async {
    // connectivityProvider (connectivity_provider.dart) subscribes to
    // connectivity_plus's platform channels as soon as any screen that
    // watches it (home_screen.dart, onefop_unified_form_screen_v4.dart,
    // offline_banner.dart, ...) is first pumped. Without a mock, whichever
    // test happens to run first in this file throws MissingPluginException
    // from inside the stream's onListen and fails — a false negative
    // unrelated to whatever that test is actually capturing.
    const eventChannel = EventChannel('dev.fluttercommunity.plus/connectivity_status');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockStreamHandler(
      eventChannel,
      MockStreamHandler.inline(
        onListen: (arguments, events) => events.success(['wifi']),
      ),
    );
    const methodChannel = MethodChannel('dev.fluttercommunity.plus/connectivity');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      methodChannel,
      (call) async => call.method == 'check' ? ['wifi'] : null,
    );
    // GridTheme's TextStyles leave fontFamily null (inherit from ambient
    // DefaultTextStyle), and the screenshot test's bare MaterialApp has no
    // theme set, so text falls back to the framework's built-in "Roboto"
    // default — load Inter under both names so either resolution path
    // renders real glyphs instead of tofu boxes.
    for (final family in ['Inter', 'Roboto']) {
      final loader = FontLoader(family)
        ..addFont(rootBundle.load('assets/fonts/Inter.ttf'))
        ..addFont(rootBundle.load('assets/fonts/Inter-Italic.ttf'));
      await loader.load();
    }
    // Icon widgets (chevron_right, expand_more, ...) render a single glyph
    // from the "MaterialIcons" font — bundled inside the Flutter SDK itself,
    // not declared as a pubspec asset, so it's absent from the test asset
    // manifest and `rootBundle.load('packages/flutter/...')` fails to
    // resolve it under `flutter test` (only a real app build injects that
    // key). Read the .otf straight off disk instead, locating the SDK root
    // from the running `dart` executable's own path
    // (.../flutter/bin/cache/dart-sdk/bin/dart[.exe]). Without this, every
    // Icon in a golden renders as a tofu/box placeholder instead of its real
    // glyph (see VT-UI/UX-01's audit note on vt_row_editor.dart's row-tile
    // chevron and picker-cell dropdown arrow). Best-effort: a missing/
    // unreadable SDK font falls back to the tofu-box glyph already
    // tolerated before this fix, not a hard failure for the rest of the
    // suite.
    try {
      final flutterRoot = File(Platform.resolvedExecutable).parent.parent.parent.parent.parent;
      final fontFile = File(
          '${flutterRoot.path}/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
      if (fontFile.existsSync()) {
        final bytes = fontFile.readAsBytesSync();
        final materialIconsLoader = FontLoader('MaterialIcons')
          ..addFont(Future.value(ByteData.sublistView(bytes)));
        await materialIconsLoader.load();
      }
    } catch (_) {
      // See comment above — degrade gracefully.
    }
    // RailLogo (the CAMLEAP mark shown in every sidebar/rail header)
    // decodes this asynchronously via Image.asset — a golden captured
    // before that decode finishes shows a gap where the logo will be,
    // another source of the same "identical render, random pass/fail"
    // problem the caret fix above addresses. Resolving it once here
    // (no BuildContext needed — ImageStream works standalone) populates
    // Flutter's image cache, so every later Image.asset for this same
    // path across the whole test run resolves synchronously from cache.
    final logoStream =
        const AssetImage('assets/images/camleap_logo.png').resolve(ImageConfiguration.empty);
    final logoDecoded = Completer<void>();
    late final ImageStreamListener logoListener;
    logoListener = ImageStreamListener(
      (image, synchronousCall) {
        logoStream.removeListener(logoListener);
        if (!logoDecoded.isCompleted) logoDecoded.complete();
      },
      onError: (error, stackTrace) {
        // Missing/unreadable asset — RailLogo's own errorBuilder already
        // degrades gracefully for this case; don't hang the whole suite
        // waiting on an image that will never arrive.
        logoStream.removeListener(logoListener);
        if (!logoDecoded.isCompleted) logoDecoded.complete();
      },
    );
    logoStream.addListener(logoListener);
    await logoDecoded.future;
  });
  await testMain();
}
