// Regression coverage for a live bug report: "the sections and
// subsections still do not show" — after the section/paperCode/wording
// fixes elsewhere this session, questions were confirmed correct, but
// no VT field anywhere carried a `subsection` value (only `paperCode`),
// so OnefopSectionMap's subsection heading + ✓/●/○ chip line never had
// anything to group by — every VT section with no table field to force
// a unit boundary (1, 2, 3, 6, 7, 9) collapsed into exactly one giant
// unit, and OnefopSectionMap self-hides for a single-unit section (see
// its own doc comment). PDF-confirmed (p.1, p.4, p.13): sections 1, 2,
// and 6 do have real subsection tiers ("1.15"/"1.16", "2.1"/"2.2",
// "6.1"/"6.2") that were simply never captured; 3/7/9 are genuinely flat
// (no subsection tier in the PDF), so those staying single-unit is
// correct, not a gap.
//
// A second, later live report ("5.1" showing as "5.1.1" instead, plus no
// descriptive text above the table) found two more things: sections 5
// and 8 also have real subsection tiers not yet captured (5.1, 8.5 —
// verified against vocationalTraining.hbs, the real printed form), and a
// distinct bug — addSimpleUnit's chip label used to be whichever field
// happened to come first (e.g. "5.1.1", even for a unit that also
// contained "5.1.2" content) instead of the shared subsection-level code.
//
// A third live report specified a VT desktop design directly (an explicit
// mockup): every VT subsection listed in full, always, in one outline —
// and nothing about a unit's identity repeated anywhere near its own
// content. This first landed as VtSectionOutline (onefop_section_units
// .dart), a body-inline panel used by ExcelSectionBody in place of
// OnefopSectionMap for EntityType.vocationalTraining — every VT unit
// carries its own real subsection value (including sections 4 and 8's
// tables, which briefly went back to carrying none while OnefopSectionMap
// was still the shared rendering path and a duplicate-text problem was
// being chased — see onefop_section_units.dart's own history for that
// detour). A fourth, later report asked for that outline to move into the
// persistent left Sidebar as a real hierarchical Section→Subsection tree
// (auto-expanding the active section) instead of sitting inline in the
// scrolling body — VtSectionOutline was removed and superseded by
// _VtSidebarSectionItem/_VtSubsectionTree (onefop_form_widgets.dart);
// ExcelSectionBody now shows only a compact breadcrumb next to the active
// table. Either way, every VT unit's own real subsection value (this
// file's actual subject) is unaffected by which widget renders it.
// OnefopSectionMap itself, still used by mobile/Simple Mode and every
// non-VT entity, is unaffected — this file's Section 1/2/6 tests below
// (predating both of these landings) still hold exactly as written.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

List<SectionUnit> _unitsFor(OnefopFormController ctrl, String sectionId) {
  final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);
  return buildTableGroupUnits(
    ctrl,
    section,
    const Locale('fr'),
    entityType: EntityType.vocationalTraining,
    simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
    mobile: false,
  );
}

void main() {
  testWidgets(
      'Section 1: splits into 3 units (core identification, 1.15, 1.16), '
      'each with its own subsection label', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section1_vocationalTraining');

    expect(units.length, 3);
    expect(units[0].subsectionLabel, isNull);
    expect(units[0].fieldIds, contains('VT1_1'));
    expect(units[0].fieldIds, contains('VT1_14'));
    expect(units[1].subsectionLabel, '1.15 Informations sur le répondant');
    expect(units[1].fieldIds, contains('VT1_15_NAME'));
    expect(units[1].fieldIds, contains('VT1_15_SEX'));
    expect(units[2].subsectionLabel,
        '1.16 Noms et contacts du Promoteur/Directeur du CFP');
    expect(units[2].fieldIds, contains('VT1_16_NAME'));
    expect(units[2].fieldIds, contains('VT1_16_EMAIL'));
  });

  testWidgets(
      'Section 2: splits into 2.1 and 2.2 units, each with its own '
      'subsection label', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section2_vocationalTraining');

    expect(units.length, 2);
    expect(units[0].subsectionLabel, '2.1 Renseignements généraux');
    expect(units[0].fieldIds, contains('VT2_1'));
    expect(units[0].fieldIds, contains('VT2_22'));
    expect(
      units[1].subsectionLabel,
      '2.2 Informations sur les autres équipements et commodités du '
          'centre de formation',
    );
    expect(units[1].fieldIds, contains('VT2_23'));
    expect(units[1].fieldIds, contains('VT2_53'));
  });

  testWidgets(
      'Section 6: splits into 6.1, 6.2 and 6.3 units, each with its own '
      'distinct subsection label — 6.3 (VT6_13) has a real, distinct '
      'printed title of its own, not a continuation of 6.2; the official '
      'form has no 6.4', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section6_vocationalTraining');

    expect(units.length, 3);
    expect(
      units[0].subsectionLabel,
      '6.1 Orientation professionnelle dans les centres de formation '
          'professionnelle',
    );
    // VT6_2/VT6_4/VT6_6 are conditionally visible (dependsOn VT6_1/3/5) —
    // hidden on a fresh, empty-data controller like this one, so only the
    // 3 unconditional fields in this subsection are candidates at all.
    expect(units[0].fieldIds, ['VT6_1', 'VT6_3', 'VT6_5']);
    expect(
      units[1].subsectionLabel,
      '6.2 Informations sur le suivi post-formation des sortants des '
          'centres de formation professionnelles du minefop',
    );
    // Same story: VT6_8 (dependsOn VT6_7) is hidden until VT6_7 = Oui.
    expect(units[1].fieldIds, ['VT6_7', 'VT6_10', 'VT6_11', 'VT6_12']);
    expect(units[2].fieldIds, ['VT6_13']);
    expect(units[2].subsectionLabel, '6.3 Sortants insérés par spécialité');
  });

  testWidgets(
      'Section 3 (genuinely flat in the PDF — no subsection tier) stays '
      'a single unit, same as before — this is correct, not a '
      'regression', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section3_vocationalTraining');
    expect(units.length, 1);
    expect(units[0].subsectionLabel, isNull);
  });

  testWidgets(
      'Section 5: all 4 subsections (5.1-5.4) get their own real, '
      'mutually distinct label — 5.1\'s chip is "5.1", not "5.1.1" (the '
      'first field\'s own code)', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section5_vocationalTraining');

    expect(units.length, 4);
    expect(units[0].subsectionLabel,
        '5.1 Manuels d\'apprentissage pour l\'année en cours');
    expect(units[0].fieldIds, ['VT5_1', 'VT5_3']);
    expect(units[0].shortLabel, '5.1',
        reason: 'the shared subsection code (VT5_1 is "5.1.1", VT5_3 is '
            '"5.1.2" — the old code showed whichever came first '
            'verbatim, "5.1.1", instead of their shared "5.1")');
    // VT5_2/VT5_4 (the "how many" follow-ups) are hidden until VT5_1/3 =
    // Oui on a fresh, empty-data controller — same reason section6's own
    // test above only sees its unconditional fields.
    expect(units[1].subsectionLabel, '5.2 Référentiel de formation');
    expect(units[1].fieldIds, ['VT5_5']);
    expect(units[2].subsectionLabel, '5.3 Nombre d\'infrastructures selon leur état');
    expect(units[2].fieldIds, ['VT5_6']);
    expect(units[3].subsectionLabel, '5.4 Equipements mobiliers');
    expect(units[3].fieldIds, ['VT5_7']);
    expect(units.map((u) => u.subsectionLabel).toSet().length, 4,
        reason: 'every subsection is distinct — no two chips silently '
            'merge into one shared run');
  });

  testWidgets(
      'Section 4: all 11 subsections (4.1-4.11) get their own real, '
      'mutually distinct label', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section4_vocationalTraining');

    expect(units.length, 11);
    expect(units.every((u) => u.subsectionLabel != null), isTrue);
    expect(units[0].subsectionLabel,
        '4.1 Effectifs des apprenants par diplôme académique le plus élevé');
    expect(units[10].subsectionLabel,
        '4.11 Effectifs des apprenants par types de bourse et selon le sexe');
    expect(units.map((u) => u.shortLabel).toList(),
        ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11']);
    expect(units.map((u) => u.subsectionLabel).toSet().length, 11);
  });

  testWidgets(
      'Section 8: all 8 subsections (8.1-8.4, 8.5, 8.6-8.8) get their own '
      'real, mutually distinct label — 8.5 (now eight trainer-status '
      'number fields after the MINEFOP Collect wizard redesign added a '
      'Contractuel category alongside Vacataire/Permanent, none of which '
      'individually conveys the overall grouping) is the one field-group '
      'among otherwise-all-table subsections; its chip stays "8.5" since '
      'every field already agreed even before the chip-label fix',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section8_vocationalTraining');

    expect(units.length, 8);
    expect(units.every((u) => u.subsectionLabel != null), isTrue);
    final vt85 = units.firstWhere((u) => u.fieldIds.contains('VT8_5_VP_M'));
    expect(vt85.subsectionLabel, '8.5 Formateurs par statut professionnel');
    expect(vt85.fieldIds, [
      'VT8_5_VP_M',
      'VT8_5_VP_F',
      'VT8_5_VNP_M',
      'VT8_5_VNP_F',
      'VT8_5_PERM_M',
      'VT8_5_PERM_F',
    ]);
    expect(vt85.shortLabel, '8.5');
    expect(units.map((u) => u.subsectionLabel).toSet().length, 8);
  });

  testWidgets(
      'Section 9: splits into a subsection-less 9.1 unit (VT9_1-3 — a '
      'single yes/no item in the printed form, not a titled subsection) '
      'and its own 9.2 unit (VT9_4)', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final units = _unitsFor(ctrl, 'section9_vocationalTraining');

    expect(units.length, 2);
    expect(units[0].subsectionLabel, isNull);
    expect(units[0].fieldIds, ['VT9_1']);
    expect(units[0].shortLabel, '9.1');
    expect(units[1].subsectionLabel, '9.2 Cinq principales perspectives');
    expect(units[1].fieldIds, ['VT9_4']);
    expect(units[1].shortLabel, '9.2');
  });
}
