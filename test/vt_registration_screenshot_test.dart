// Throwaway visual-audit tool — renders the VT registration flow (entity
// picker, VT-specific fields, the functionalStatus->nonFunctionalReason
// conditional reveal) and the questionnaire opening with VT data prefilled
// the way home_screen.dart's _companyToInitialData() produces it, so the
// 2026-08-30/31 VT registration work can actually be inspected rather than
// guessed from reading the code. Not a real regression test; safe to delete.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/data/minefop_models.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_unified_form_screen_v4.dart';
import 'package:dsmo_app/screens/register_constants.dart';
import 'package:dsmo_app/screens/register_steps.dart';

Future<void> _captureWidget(
    WidgetTester tester, String name, Widget child, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: child),
      ),
    ),
  );
  await tester.pump();
  tester.takeException();
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  testWidgets('capture entity-type picker',
      (tester) async {
    EntityType? selected;
    await _captureWidget(
      tester,
      'vt_registration_entity_picker',
      StepEntityType(selected: selected, onSelect: (t) => selected = t),
      const Size(900, 1400),
    );
  });

  testWidgets('capture VT entity-info fields — functionalStatus not yet Non-fonctionnelle (reason hidden)',
      (tester) async {
    final formKey = GlobalKey<FormState>();
    final config = entityConfigs[EntityType.vocationalTraining]!;
    final controllers = <String, TextEditingController>{
      for (final f in config.fields)
        if (f.options == null && !f.isPhone) f.key: TextEditingController(),
    };
    final entityData = <String, dynamic>{};

    await _captureWidget(
      tester,
      'vt_registration_fields_status_functional',
      StepEntityInfo(
        formKey: formKey,
        entityType: EntityType.vocationalTraining,
        config: config,
        controllers: controllers,
        entityData: entityData,
        onChanged: () {},
        onDropdownChanged: (k, v) => entityData[k] = v,
      ),
      const Size(900, 2400),
    );
  });

  testWidgets('capture VT entity-info fields — functionalStatus = Non-fonctionnelle (reason revealed)',
      (tester) async {
    final formKey = GlobalKey<FormState>();
    final config = entityConfigs[EntityType.vocationalTraining]!;
    final controllers = <String, TextEditingController>{
      for (final f in config.fields)
        if (f.options == null && !f.isPhone) f.key: TextEditingController(),
    };
    final entityData = <String, dynamic>{
      'cfpType': 'Centre de Formation Professionnelle Rapide (CFPR)',
      'educationSystem': 'Public',
      'functionalStatus': 'Non-fonctionnelle',
    };

    await _captureWidget(
      tester,
      'vt_registration_fields_status_nonfunctional',
      StepEntityInfo(
        formKey: formKey,
        entityType: EntityType.vocationalTraining,
        config: config,
        controllers: controllers,
        entityData: entityData,
        onChanged: () {},
        onDropdownChanged: (k, v) => entityData[k] = v,
      ),
      const Size(900, 2600),
    );
  });

  testWidgets('capture VT questionnaire Section 1 opening pre-filled from registered Company data',
      (tester) async {
    // Mirrors exactly what home_screen.dart's _companyToInitialData()
    // produces (VT1_2/VT1_3/VT1_10/VT1_11/VT1_12/VT1_13(+OTHER)/VT1_14/
    // VT1_16_*) for a mock registered Company row carrying the new VT
    // registration-time fields (sigle, cfpType, educationSystem,
    // functionalStatus, nonFunctionalReason(Other), promoterName/Sex/
    // Phone1/Phone2) — same key set the real switch case writes, not a
    // different shape.
    const initialData = <String, dynamic>{
      'S0Q01': 'Jean Dupont',
      'S0Q02': 'Directeur',
      'S0Q03_TEL1': '677123456',
      'VT1_2': 'Centre de Formation Rapide de Yaoundé',
      'VT1_3': 'CFRY',
      'VT1_10': 'Public',
      'VT1_11': 'Centre de Formation Professionnelle Rapide (CFPR)',
      'VT1_12': 'Fonctionnelle',
      'VT1_14': '2015',
      'VT1_16_NAME': 'Marie Ngo Bell',
      'VT1_16_SEX': 'Féminin',
      'VT1_16_TEL1': '699112233',
      'VT1_16_TEL2': '677998877',
    };

    tester.view.physicalSize = const Size(1440, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          locale: const Locale('fr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: OnefopUnifiedFormScreenV4(
            entityType: EntityType.vocationalTraining,
            initialData: initialData,
            onSave: (_) {},
          ),
        ),
      ),
    );
    await tester.pump();
    tester.takeException();
    await tester.pump(const Duration(seconds: 1));

    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/vt_registration_questionnaire_prefilled.png'));
  });
}
