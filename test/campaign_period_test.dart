// core/focus/campaign_period.dart, and its use by OnefopFormController for
// the questions and KPI headers its old id/phrase lists missed.
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/campaign_period.dart';
import 'package:dsmo_app/core/i18n/localized_text.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final start = DateTime(2027, 1, 1);
  final end = DateTime(2027, 6, 30);

  group('withCampaignPeriod', () {
    test('replaces every placeholder variant', () {
      const text = LocalizedText(
        fr: 'A du premier Janvier 2025 à ce jour ? B du 1er Janvier 2026 à ce jour?',
        en: 'A from the 1st of January 2025 to the present day? B from 1st January 2026 to date?',
      );
      final out = withCampaignPeriod(text, start, end);
      expect(out.fr, 'A du 01/01/2027 au 30/06/2027 ? B du 01/01/2027 au 30/06/2027?');
      expect(out.en, 'A from 01/01/2027 to 30/06/2027? B from 01/01/2027 to 30/06/2027?');
    });

    test('derives the vocational-training prior academic year', () {
      const text = LocalizedText(fr: "Sortants pour l'année antérieur (2024-2025)", en: 'Outgoing trainees');
      expect(withCampaignPeriod(text, start, end).fr, "Sortants pour l'année antérieur (2025-2026)");
      // Unchanged output for a 2026 campaign.
      expect(withCampaignPeriod(text, DateTime(2026, 1, 1), DateTime(2026, 6, 30)).fr,
          "Sortants pour l'année antérieur (2024-2025)");
    });

    test('returns the same instance when there is nothing to replace', () {
      const text = LocalizedText(fr: 'Ex: 2010', en: 'E.g. 2010');
      expect(identical(withCampaignPeriod(text, start, end), text), isTrue);
    });
  });

  group('kpiPeriodLabels', () {
    test('the period column follows the campaign', () {
      final labels = kpiPeriodLabels(start, end);
      expect(labels[0].fr, 'Du 01/01/2027 au 30/06/2027');
      expect(labels[0].en, 'From 01/01/2027 to 30/06/2027');
      expect(kpiPeriodLabels(null, null)[0].fr, 'Du non définie au non définie');
    });

    test('the outlooks name no date or year, with or without a period', () {
      for (final labels in [kpiPeriodLabels(start, end), kpiPeriodLabels(null, null)]) {
        expect(labels[1].fr, 'Perspectives à fin Décembre');
        expect(labels[1].en, 'Outlook at end of December');
        expect(labels[2].fr, 'Perspectives à fin Juin');
        expect(labels[2].en, 'Outlook at end of June');
      }
    });
  });

  group('OnefopFormController', () {
    Future<OnefopFormController> build(EntityType type) async {
      final c = OnefopFormController(
        entityType: type,
        initialData: const {},
        campaignPeriodStart: start,
        campaignPeriodEnd: end,
        onSave: (_) {},
      );
      await c.initialize();
      return c;
    }

    test('rewrites the project-programme questions', () async {
      final c = await build(EntityType.projectProgram);
      final pp = c.schema!.fields.where((f) => f.id.startsWith('PP_S4Q')).toList();
      expect(pp, isNotEmpty);
      for (final f in pp) {
        expect(f.label!.fr, isNot(matches(RegExp(r'Janvier 20\d\d'))), reason: f.id);
        expect(f.label!.en, isNot(matches(RegExp(r'January 20\d\d'))), reason: f.id);
      }
      c.dispose();
    });

    test('gives the KPI table the period headers', () async {
      final c = await build(EntityType.projectProgram);
      final kpi = c.schema!.fields
          .where((f) => (f.tableSpec?['template'] as String?)?.trim() == 'kpi_period_table')
          .toList();
      expect(kpi, isNotEmpty);
      final labels = kpi.first.tableSpec![kKpiPeriodLabelsKey] as List<LocalizedText>;
      expect(labels[0].fr, 'Du 01/01/2027 au 30/06/2027');
      c.dispose();
    });

    test('leaves no fixed reference year in any enterprise question', () async {
      final c = await build(EntityType.enterprise);
      for (final f in c.schema!.fields) {
        final label = f.label;
        if (label == null) continue;
        expect(label.fr, isNot(matches(RegExp(r'Janvier 20\d\d'))), reason: f.id);
        expect(label.en, isNot(matches(RegExp(r'January 20\d\d'))), reason: f.id);
      }
      c.dispose();
    });
  });
}
