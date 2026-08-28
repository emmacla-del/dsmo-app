// S21Q01 used to hard-code "1er janvier 2025 à ce jour" / "the 1st of
// January 2025 to the present day" — wrong for any campaign other than the
// one that happened to be active when that text was written. It must now
// read the active campaign's data-collection period (SubmissionRound.
// periodStart/periodEnd, surfaced via GET /onefop/active-quarter and
// threaded into OnefopFormController.campaignPeriodStart/End — see
// OnefopFormController._applyCampaignPeriodLabels()) instead of embedding
// its own date.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

const _fr = Locale('fr');
const _en = Locale('en');

Future<OnefopFormController> _controllerWithPeriod({
  DateTime? start,
  DateTime? end,
}) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.enterprise,
    initialData: const {},
    campaignPeriodStart: start,
    campaignPeriodEnd: end,
    onSave: (_) {},
  );
  await ctrl.initialize();
  return ctrl;
}

String _label(OnefopFormController ctrl, Locale locale) =>
    ctrl.schema!.getField('S21Q01')!.label!.of(locale);

void main() {
  // 1. No hard-coded year/date in what actually reaches the user. The AST
  // (onefop_ast.dart) keeps a recognizable "du premier Janvier 2025 à ce
  // jour" placeholder phrase as OnefopFormController._applyCampaignPeriodLabels'
  // replace-anchor (shared with every sibling question in
  // kPeriodBasedQuestionIds — S22Q01–05, S23Q01–02, S3Q01, S3Q03, S4Q01),
  // so that raw phrase existing in source is expected, not a bug — what
  // must never happen is a 2025 surviving into the *resolved* label. See
  // "no active campaign in context" below for the no-period case, and the
  // group right here for the normal one.
  group('active campaign with a defined period', () {
    testWidgets('French label shows the campaign start/end dates', (tester) async {
      final ctrl = await _controllerWithPeriod(
        start: DateTime(2026, 1, 1),
        end: DateTime(2026, 6, 30),
      );
      final label = _label(ctrl, _fr);

      expect(label.contains('01/01/2026'), isTrue);
      expect(label.contains('30/06/2026'), isTrue);
      expect(label.contains('2025'), isFalse);
      expect(label.contains('premier Janvier'), isFalse);
      expect(label.contains('à ce jour'), isFalse);
      // Bilingual wording is preserved verbatim apart from the dates.
      expect(
        label.startsWith(
            "Combien de demandes d'emplois avez-vous enregistré selon la "
            "catégorie socioprofessionnelle, le sexe et la tranche d'âge du"),
        isTrue,
      );
    });

    testWidgets('English label shows the same campaign start/end dates', (tester) async {
      final ctrl = await _controllerWithPeriod(
        start: DateTime(2026, 1, 1),
        end: DateTime(2026, 6, 30),
      );
      final label = _label(ctrl, _en);

      expect(label.contains('01/01/2026'), isTrue);
      expect(label.contains('30/06/2026'), isTrue);
      expect(label.contains('2025'), isFalse);
      expect(label.toLowerCase().contains('1st of january'), isFalse);
      expect(label.toLowerCase().contains('present day'), isFalse);
    });

    testWidgets('French and English display the identical dates (one source of truth)',
        (tester) async {
      final ctrl = await _controllerWithPeriod(
        start: DateTime(2026, 1, 1),
        end: DateTime(2026, 6, 30),
      );
      final fr = _label(ctrl, _fr);
      final en = _label(ctrl, _en);

      for (final date in ['01/01/2026', '30/06/2026']) {
        expect(fr.contains(date), isTrue);
        expect(en.contains(date), isTrue);
      }
    });
  });

  testWidgets('changing the campaign period changes S21Q01 automatically', (tester) async {
    final first = await _controllerWithPeriod(
      start: DateTime(2026, 1, 1),
      end: DateTime(2026, 6, 30),
    );
    final second = await _controllerWithPeriod(
      start: DateTime(2026, 7, 1),
      end: DateTime(2026, 12, 31),
    );

    final firstLabel = _label(first, _fr);
    final secondLabel = _label(second, _fr);

    expect(firstLabel, isNot(equals(secondLabel)));
    expect(firstLabel.contains('01/01/2026'), isTrue);
    expect(firstLabel.contains('30/06/2026'), isTrue);
    expect(secondLabel.contains('01/07/2026'), isTrue);
    expect(secondLabel.contains('31/12/2026'), isTrue);
    // Switching the active campaign is exactly this: a fresh controller
    // (fresh screen) reading a different SubmissionRound's period — the
    // question text must not retain the previous campaign's dates.
    expect(secondLabel.contains('01/01/2026'), isFalse);
  });

  testWidgets('an unset campaign end date never falls back to the device clock',
      (tester) async {
    final ctrl = await _controllerWithPeriod(
      start: DateTime(2026, 1, 1),
      end: null,
    );
    final label = _label(ctrl, _fr);

    final now = DateTime.now();
    final todayFormatted =
        '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';
    expect(label.contains(todayFormatted), isFalse,
        reason: "the campaign's end date must come from campaign "
            'configuration, never DateTime.now()');
    // Follows the app's existing "not set" convention (see periodUndefined
    // in app_fr.arb/app_en.arb) rather than a bespoke S21Q01 fallback.
    expect(label.contains('non définie'), isTrue);
  });

  testWidgets('no active campaign in context: both dates fall back, no crash',
      (tester) async {
    final ctrl = await _controllerWithPeriod();
    final fr = _label(ctrl, _fr);
    final en = _label(ctrl, _en);

    expect(fr.contains('non définie'), isTrue);
    expect(en.contains('not set'), isTrue);
    expect(fr.contains('2025'), isFalse);
    expect(en.contains('2025'), isFalse);
  });

  testWidgets(
      'S21Q01 is still a csp_gender_age_table (dynamic label only, nothing else changed)',
      (tester) async {
    final ctrl = await _controllerWithPeriod(
      start: DateTime(2026, 1, 1),
      end: DateTime(2026, 6, 30),
    );
    final field = ctrl.schema!.getField('S21Q01')!;

    expect(field.type, 'table');
    expect(field.paperCode, 'S21Q01');
    expect(field.tableSpec?['template'], 'csp_gender_age_table');
    expect(field.tableSpec?['prefix'], 's21q01');
  });
}
