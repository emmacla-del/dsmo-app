// Throwaway verification for the "Rester connecté" fix: setToken(persist:
// false) must not leave anything a fresh ApiClient instance (standing in
// for the next app launch, since _memoryToken always starts null) can see,
// while setToken(persist: true) (the default) must.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:dsmo_app/data/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = Directory.systemTemp.createTempSync('remember_me_test');
    Hive.init(tempDir.path);
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    tempDir.deleteSync(recursive: true);
  });

  test('persist: false — a fresh ApiClient (next app launch) finds no token', () async {
    final loginSession = ApiClient();
    await loginSession.setToken('secret-token', persist: false);

    // Same instance, same "session": token still usable immediately after.
    expect(await loginSession.getStoredToken(), 'secret-token');

    // A new instance has no in-memory token and must fall back to Hive,
    // which should be empty — this is what _tryRestore() sees on cold start.
    final nextLaunch = ApiClient();
    expect(await nextLaunch.getStoredToken(), isNull);
  });

  test('persist: true (default) — a fresh ApiClient (next app launch) finds the token',
      () async {
    final loginSession = ApiClient();
    await loginSession.setToken('secret-token');

    final nextLaunch = ApiClient();
    expect(await nextLaunch.getStoredToken(), 'secret-token');
  });

  test('persist: false clears a token an earlier persist: true login left behind',
      () async {
    final firstLogin = ApiClient();
    await firstLogin.setToken('old-remembered-token');

    final secondLogin = ApiClient();
    await secondLogin.setToken('new-token', persist: false);

    final nextLaunch = ApiClient();
    expect(await nextLaunch.getStoredToken(), isNull,
        reason: "this login's persist:false choice should override the earlier remembered token");
  });
}
