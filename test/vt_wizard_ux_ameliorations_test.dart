// Regression and feature coverage for the VTC Wizard UI/UX ameliorations:
// 1. Live phone formatting preview + email chip prefix
// 2. Cascading Cameroon administrative hierarchy (Region -> Department -> Sub-division)
// 3. Explanatory contextual info badges
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_cameroon_admin_data.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_constants.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_fields.dart';

Future<OnefopFormController> _createController(
    [Map<String, dynamic>? initialData]) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData ?? const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

void main() {
  group('Cameroon Administrative Hierarchy Data', () {
    test('contains 10 official regions and all 58 departments', () {
      expect(kCameroonAdminHierarchy.length, 10);
      final totalDepartments = kCameroonAdminHierarchy.fold<int>(
        0,
        (sum, r) => sum + r.departments.length,
      );
      expect(totalDepartments, 58);
    });

    test('findCameroonRegion is case-insensitive', () {
      final centre = findCameroonRegion('centre');
      expect(centre, isNotNull);
      expect(centre!.name, 'Centre');
      expect(centre.departments.any((d) => d.name == 'Mfoundi'), isTrue);

      final littoral = findCameroonRegion('LITTORAL');
      expect(littoral, isNotNull);
      expect(littoral!.departments.any((d) => d.name == 'Wouri'), isTrue);
    });

    test('findCameroonDepartment finds department and its subdivisions', () {
      final mfoundi = findCameroonDepartment('Mfoundi');
      expect(mfoundi, isNotNull);
      expect(mfoundi!.subdivisions.contains('Yaoundé I'), isTrue);

      final wouri = findCameroonDepartment('wouri');
      expect(wouri, isNotNull);
      expect(wouri!.subdivisions.contains('Douala I'), isTrue);
    });
  });

  group('Contextual Tooltip Badges', () {
    test('kFieldTooltips covers key complex bureaucratic terms', () {
      expect(kFieldTooltips.containsKey('VT1_1'), isTrue);
      expect(kFieldTooltips.containsKey('VT1_9'), isTrue);
      expect(kFieldTooltips.containsKey('VT1_13'), isTrue);
      expect(kFieldTooltips.containsKey('VT1_17'), isTrue);
      expect(kFieldTooltips.containsKey('VT2_1'), isTrue);
      expect(kFieldTooltips.containsKey('VT2_11'), isTrue);
    });
  });

  group('Phone and Email Field Enhancements', () {
    testWidgets('Email field displays @ prefix chip', (tester) async {
      final ctrl = await _createController();
      addTearDown(ctrl.dispose);
      final schema = ctrl.schema!;
      final emailField = schema.getField('VT1_15');

      if (emailField != null) {
        await tester.pumpWidget(
          MaterialApp(
            locale: const Locale('fr'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: vtWizardBuildField(ctrl, emailField),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('@'), findsOneWidget);
      }
    });

    testWidgets('Phone field displays live Cameroon phone preview on typing',
        (tester) async {
      final ctrl = await _createController();
      addTearDown(ctrl.dispose);
      final schema = ctrl.schema!;
      // VT1_13 used to be this phone field but was retyped to a 5-way
      // radio (VT-UI/UX-06, see onefop_ast.dart) — the WhatsApp number
      // field is now VT1_15_TEL1.
      final phoneField = schema.getField('VT1_15_TEL1');

      if (phoneField != null) {
        await tester.pumpWidget(
          MaterialApp(
            locale: const Locale('fr'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: vtWizardBuildField(ctrl, phoneField),
            ),
          ),
        );
        await tester.pumpAndSettle();

        final textField = find.byType(TextField);
        expect(textField, findsOneWidget);

        await tester.enterText(textField, '699123456');
        await tester.pump(const Duration(milliseconds: 100));

        expect(find.textContaining('699 12 34 56'), findsOneWidget);

        // Allow the autosave debounce (schedAS: 3s, onefop_form_controller.dart)
        // to finish before teardown, or its Timer is still pending at dispose.
        await tester.pump(const Duration(seconds: 4));
      }
    });
  });

  group('Cascading Cameroon Admin Suggestions in Section 1', () {
    testWidgets('Selecting Region populates Division suggestion chips',
        (tester) async {
      final ctrl = await _createController({
        'VT1_4': 'Centre',
      });
      addTearDown(ctrl.dispose);
      final schema = ctrl.schema!;
      final divField = schema.getField('VT1_5');

      if (divField != null) {
        await tester.pumpWidget(
          MaterialApp(
            locale: const Locale('fr'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: vtWizardBuildField(ctrl, divField),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Mfoundi'), findsOneWidget);

        await tester.tap(find.text('Mfoundi'));
        await tester.pump(const Duration(milliseconds: 100));

        expect(ctrl.data['VT1_5'], 'Mfoundi');

        // Allow the autosave debounce (schedAS: 3s, onefop_form_controller.dart)
        // to finish before teardown, or its Timer is still pending at dispose.
        await tester.pump(const Duration(seconds: 4));
      }
    });
  });
}
