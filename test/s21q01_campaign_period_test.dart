// Every ONEFOP question whose wording refers to the questionnaire's active
// data-collection period (S21Q01, S22Q01-05, S23Q01-02, S3Q01, S3Q03,
// S4Q01 — see OnefopFormController.kPeriodBasedQuestionIds) must derive
// that period from the active campaign
// (OnefopFormController.campaignPeriodStart/End — the same SubmissionRound
// the /onefop/active-quarter gate already reads), not a hard-coded date.
// See OnefopFormController._applyCampaignPeriodLabels().
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<OnefopFormController> _buildController({
  EntityType entityType = EntityType.enterprise,
  DateTime? campaignPeriodStart,
  DateTime? campaignPeriodEnd,
}) async {
  final controller = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    campaignPeriodStart: campaignPeriodStart,
    campaignPeriodEnd: campaignPeriodEnd,
    onSave: (_) {},
  );
  await controller.initialize();
  return controller;
}

String _labelFr(OnefopFormController c, String id) =>
    c.schema!.fields.firstWhere((f) => f.id == id).label!.fr;
String _labelEn(OnefopFormController c, String id) =>
    c.schema!.fields.firstWhere((f) => f.id == id).label!.en;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('S21Q01 displays the active campaign period (FR + EN)', () async {
    final c = await _buildController(
      campaignPeriodStart: DateTime(2026, 1, 1),
      campaignPeriodEnd: DateTime(2026, 6, 30),
    );
    expect(_labelFr(c, 'S21Q01'), contains('01/01/2026 au 30/06/2026'));
    expect(_labelEn(c, 'S21Q01'), contains('from 01/01/2026 to 30/06/2026'));
    c.dispose();
  });

  test('every period-based question displays the active campaign period, no hard-coded 2025', () async {
    final c = await _buildController(
      campaignPeriodStart: DateTime(2026, 1, 1),
      campaignPeriodEnd: DateTime(2026, 6, 30),
    );
    // S22Q05_ENTERPRISE is the enterprise variant; S22Q05_OTHER is filtered
    // out of an enterprise schema entirely, so it's excluded from this list.
    for (final id in [
      'S21Q01',
      'S22Q01',
      'S22Q02',
      'S22Q03',
      'S22Q04',
      'S22Q05_ENTERPRISE',
      'S23Q01',
      'S23Q02',
      'S3Q01',
      'S3Q03',
      'S4Q01',
    ]) {
      expect(_labelFr(c, id), contains('01/01/2026 au 30/06/2026'), reason: id);
      expect(_labelEn(c, id), contains('from 01/01/2026 to 30/06/2026'), reason: id);
      expect(_labelFr(c, id), isNot(contains('2025')), reason: id);
      expect(_labelEn(c, id), isNot(contains('2025')), reason: id);
      expect(_labelFr(c, id), isNot(contains('à ce jour')), reason: id);
      expect(_labelEn(c, id), isNot(contains('present day')), reason: id);
    }
    c.dispose();
  });

  test('S22Q05 resolves the entity-appropriate variant for a non-enterprise entity type', () async {
    final c = await _buildController(
      entityType: EntityType.ong,
      campaignPeriodStart: DateTime(2026, 1, 1),
      campaignPeriodEnd: DateTime(2026, 6, 30),
    );
    expect(_labelFr(c, 'S22Q05_OTHER'), contains('01/01/2026 au 30/06/2026'));
    expect(c.schema!.fields.any((f) => f.id == 'S22Q05_ENTERPRISE'), isFalse);
    c.dispose();
  });

  test('S21Q01 and S22Q01 display the identical campaign period (single source of truth)', () async {
    final c = await _buildController(
      campaignPeriodStart: DateTime(2026, 1, 1),
      campaignPeriodEnd: DateTime(2026, 6, 30),
    );
    expect(_labelFr(c, 'S21Q01'), contains('01/01/2026 au 30/06/2026'));
    expect(_labelFr(c, 'S22Q01'), contains('01/01/2026 au 30/06/2026'));
    c.dispose();
  });

  test('changing the campaign period changes every period-based question automatically', () async {
    final campaignA = await _buildController(
      campaignPeriodStart: DateTime(2026, 1, 1),
      campaignPeriodEnd: DateTime(2026, 6, 30),
    );
    final campaignB = await _buildController(
      campaignPeriodStart: DateTime(2026, 7, 1),
      campaignPeriodEnd: DateTime(2026, 12, 31),
    );
    for (final id in ['S21Q01', 'S22Q01', 'S3Q01', 'S4Q01']) {
      expect(_labelFr(campaignA, id), isNot(_labelFr(campaignB, id)), reason: id);
      expect(_labelFr(campaignB, id), contains('01/07/2026 au 31/12/2026'), reason: id);
      expect(_labelEn(campaignB, id), contains('from 01/07/2026 to 31/12/2026'), reason: id);
    }
    campaignA.dispose();
    campaignB.dispose();
  });

  test('a campaign end date is used instead of the device current date', () async {
    // Regardless of today's real date, a fixed campaign end date must be
    // the one rendered — never DateTime.now().
    final fixedEnd = DateTime(2020, 3, 15);
    final c = await _buildController(
      campaignPeriodStart: DateTime(2020, 1, 1),
      campaignPeriodEnd: fixedEnd,
    );
    expect(_labelFr(c, 'S21Q01'), contains('15/03/2020'));
    expect(_labelFr(c, 'S4Q01'), contains('15/03/2020'));
    expect(_labelFr(c, 'S21Q01'), isNot(contains('à ce jour')));
    expect(_labelEn(c, 'S21Q01'), isNot(contains('present day')));
    c.dispose();
  });

  test('no active campaign falls back to the app\'s existing "period undefined" wording, never "not set to not set" from a missing value', () async {
    final c = await _buildController();
    expect(_labelFr(c, 'S21Q01'), contains('non définie'));
    expect(_labelEn(c, 'S21Q01'), contains('not set'));
    // The fallback still names the period as unresolved rather than
    // silently omitting it or fabricating a date.
    expect(_labelEn(c, 'S21Q01'), isNot(contains('present day')));
    c.dispose();
  });

  test('period-based question labels are driven solely by constructor params (single source of truth)', () async {
    // Two controllers built from identical initialData but different
    // campaign-period params diverge on every period-based question —
    // proving there is no independent, per-question date state fetched or
    // cached separately from the constructor-injected campaign period.
    final withPeriod = await _buildController(
      campaignPeriodStart: DateTime(2026, 1, 1),
      campaignPeriodEnd: DateTime(2026, 6, 30),
    );
    final withoutPeriod = await _buildController();
    for (final id in ['S21Q01', 'S22Q01', 'S3Q01', 'S4Q01']) {
      expect(_labelFr(withPeriod, id), isNot(_labelFr(withoutPeriod, id)), reason: id);
    }
    withPeriod.dispose();
    withoutPeriod.dispose();
  });

  test('existing questionnaire behavior unchanged: questions with no period wording keep their static text', () async {
    // S3Q02 ("Quels sont les principaux motifs de licenciement ?") has no
    // date-window wording at all — the campaign-period patch must not
    // touch fields outside kPeriodBasedQuestionIds.
    final withPeriod = await _buildController(
      campaignPeriodStart: DateTime(2026, 1, 1),
      campaignPeriodEnd: DateTime(2026, 6, 30),
    );
    final withoutPeriod = await _buildController();
    expect(_labelFr(withPeriod, 'S3Q02'), equals(_labelFr(withoutPeriod, 'S3Q02')));
    expect(_labelFr(withPeriod, 'S3Q02'), contains('motifs de licenciement'));
    withPeriod.dispose();
    withoutPeriod.dispose();
  });
}
