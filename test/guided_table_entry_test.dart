// Mode Guidé on a phone (guided_table_entry.dart, 2026-11-27): the Flutter
// adaptation of the React web app's GuidedStatisticalEntry — one question
// per screen, the total then the women, the men deduced, a summary.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/onefop_form_loader.dart';
import 'package:dsmo_app/core/focus/renderers/grid_render_spec.dart';
import 'package:dsmo_app/core/focus/renderers/guided_table_entry.dart';
import 'package:dsmo_app/core/focus/renderers/table_renderer.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart'
    show EntityType, entityTypeForSchema, entityTypeString;
import 'package:dsmo_app/screens/onefop/onefop_table_engine.dart';

const _fr = Locale('fr');

/// The shape of one S21Q01 category card: sexes as rows, age bands as
/// columns, a computed Total row and column.
GridRenderSpec _cadresCard() {
  const ages = ['15_24', '25_34', '35p', 'total'];
  List<String> row(String sex) => [for (final a in ages) 's21q01_cadres_${sex}_$a'];
  final matrix = [row('m'), row('f'), row('t')];
  bool isTotal(String id) => id.contains('_t_') || id.endsWith('_total');
  return GridRenderSpec(
    id: 's21q01_cadres',
    rowLabels: const ['Homme', 'Femme', 'Total'],
    matrix: matrix,
    headers: const [
      HeaderNode('15–24'),
      HeaderNode('25–34'),
      HeaderNode('35+'),
      HeaderNode('Total'),
    ],
    cellSpec: (id) => CellSpec(
        id: id, type: CellType.number, editable: !isTotal(id)),
    isTotalCell: isTotal,
  );
}

GridRenderSpec _withCategories() => GridRenderSpec(
      id: 's21q01',
      headers: const [],
      categoryGridGroups: [
        CategoryGridGroup(categories: [
          CategoryMiniGrid(label: 'Cadres', spec: _cadresCard()),
        ]),
      ],
    );

Future<void> _pump(WidgetTester tester, Widget child, {double width = 360}) async {
  tester.view.physicalSize = Size(width, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(body: SingleChildScrollView(child: child)),
  ));
}

void main() {
  group('GuidedTableModel (react-web resolveGuidedScope)', () {
    test('a category card gives one question per age band, worded as React',
        () {
      final model = GuidedTableModel.from(_withCategories(), 's21q01', _fr)!;
      expect(model.questions, hasLength(3));
      final q = model.questions.first;
      expect(q.categoryTag, 'Cadres');
      expect(q.dimensionTag, '15–24');
      expect(q.isGenderSplit, isTrue);
      expect(q.maleId, 's21q01_cadres_m_15_24');
      expect(q.femaleId, 's21q01_cadres_f_15_24');
      expect(q.totalId, 's21q01_cadres_t_15_24');
      expect(
          q.prompt,
          "Combien de demandes d'emploi avez-vous reçues de la part de cadres "
          'de moins de 25 ans au cours du trimestre ?');
    });

    test('a table without a sex axis asks each cell on its own', () {
      final spec = GridRenderSpec(
        id: 'x',
        rowLabels: const ['Stage de vacances'],
        matrix: const [
          ['x_vac_n']
        ],
        headers: const [HeaderNode('Nombre')],
        cellSpec: (id) => CellSpec(id: id, type: CellType.number),
      );
      final q = GuidedTableModel.from(spec, 'x', _fr)!.questions.single;
      expect(q.isGenderSplit, isFalse);
      expect(q.singleId, 'x_vac_n');
    });

    test('a reasons row carries its typed reason, as React', () {
      final spec = GridRenderSpec(
        id: 's3q02',
        rowLabels: const ['Motif 1'],
        matrix: const [
          ['s3q02_1_m', 's3q02_1_f', 's3q02_1_t']
        ],
        headers: const [HeaderNode('M'), HeaderNode('F'), HeaderNode('Total')],
        rowLabelCellIds: const ['S3Q02_REASON_1_TEXT'],
        cellSpec: (id) => CellSpec(
            id: id, type: CellType.number, editable: !id.endsWith('_t')),
      );
      final q = GuidedTableModel.from(spec, 's3q02', _fr)!.questions.single;
      expect(q.textField?.fieldId, 'S3Q02_REASON_1_TEXT');
      expect(q.textField?.label, 'Motif de licenciement 1');
      expect(q.prompt, 'Combien de personnes avez-vous licenciées pour ce motif ?');
    });

    // Every real table of the employer, administration and project forms:
    // guided questions only ever write cells the form really stores.
    for (final type in [
      EntityType.enterprise,
      EntityType.administration,
      EntityType.projectProgram,
    ]) {
      test("${type.name}: guided questions use only the table's own cells", () {
        final schema =
            OnefopFormLoader.loadForEntity(entityTypeForSchema(type));
        var guided = 0;
        for (final f in schema.fields.where((f) => f.type == 'table')) {
          if (f.tableSpec == null) continue;
          final spec = TableRenderer.debugRenderSpecFor(f, _fr,
              entityType: entityTypeString(type));
          final prefix =
              ((f.tableSpec!['prefix'] as String?) ?? f.id).toLowerCase();
          final model = GuidedTableModel.from(spec, prefix, _fr);
          if (model == null) continue;
          guided++;
          final stored = TableCellEngine.cellIds(f).toSet();
          for (final q in model.questions) {
            for (final id in q.breakdownIds) {
              expect(stored, contains(id),
                  reason: '${f.id}: guided cell $id is not one of its cells');
            }
          }
        }
        expect(guided, greaterThan(0),
            reason: 'no table of ${type.name} is asked in Mode Guidé');
      });
    }
  });

  group('GuidedStatisticalEntry (react-web GuidedStatisticalEntry)', () {
    Future<Map<String, int>> pumpEntry(WidgetTester tester,
        {double width = 360}) async {
      final values = <String, int>{};
      await _pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => GuidedOrCards(
            spec: _withCategories(),
            cards: const Text('cards'),
            numberValues: values,
            enteredValues: values,
            onNumberChanged: (id, v) => setState(
                () => v == null ? values.remove(id) : values[id] = v),
            tableId: 's21q01',
            locale: _fr,
          ),
        ),
        width: width,
      );
      return values;
    }

    bool advance() => GuidedRegistry.handles['s21q01']!.advance();

    testWidgets('total 10, of whom 4 women: 6 men deduced', (tester) async {
      final values = await pumpEntry(tester);
      expect(find.text('cards'), findsNothing);
      expect(find.text('Question 1 sur 3'), findsOneWidget);

      await tester.enterText(find.byType(TextField).first, '10');
      await tester.pump();
      expect(find.text('Parmi eux, combien de femmes ?'), findsOneWidget);
      await tester.enterText(find.byType(TextField).at(1), '4');
      await tester.pump();

      expect(values['s21q01_cadres_m_15_24'], 6);
      expect(values['s21q01_cadres_f_15_24'], 4);
      expect(
          find.textContaining('homme(s) déduit(s) automatiquement',
              findRichText: true),
          findsOneWidget);
    });

    testWidgets('more women than the total is refused', (tester) async {
      final values = await pumpEntry(tester);
      await tester.enterText(find.byType(TextField).first, '3');
      await tester.pump();
      await tester.enterText(find.byType(TextField).at(1), '5');
      await tester.pump();
      expect(find.text('Ce nombre ne peut pas dépasser le total (3).'),
          findsOneWidget);
      expect(values.containsKey('s21q01_cadres_f_15_24'), isFalse);
    });

    testWidgets("the page's Suivant checks the question, then steps on",
        (tester) async {
      final values = await pumpEntry(tester);
      expect(advance(), isTrue);
      await tester.pump();
      expect(
          find.text('Indiquez le nombre total, ou choisissez « Aucun (0) ».'),
          findsOneWidget);

      await tester.tap(find.text('Aucun (0)'));
      await tester.pump();
      expect(values['s21q01_cadres_m_15_24'], 0);
      expect(values['s21q01_cadres_f_15_24'], 0);
      expect(find.text('✓ Déclaré à 0 pour ce groupe.'), findsOneWidget);

      expect(advance(), isTrue);
      await tester.pump();
      expect(find.text('Question 2 sur 3'), findsOneWidget);
    });

    testWidgets('after the last question: « Vérifiez vos réponses »',
        (tester) async {
      await pumpEntry(tester);
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text('Aucun (0)'));
        await tester.pump();
        expect(advance(), isTrue);
        await tester.pump();
      }
      expect(find.text('Vérifiez vos réponses'), findsOneWidget);
      expect(find.text('Modifier'), findsNWidgets(3));
      // On the summary the page's Suivant moves on to the next question.
      expect(advance(), isFalse);
    });

    testWidgets('a wide screen keeps the cards', (tester) async {
      await pumpEntry(tester, width: 800);
      expect(find.text('cards'), findsOneWidget);
    });
  });
}
