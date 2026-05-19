// lib/core/focus/renderers/spreadsheet_compiler.dart
//
// ✅ PURE LOGIC — zero Flutter imports.
// Builds GridRenderSpec data objects only.
// Rendering is handled by GenericSpreadsheetTable → GridLayoutEngine.
//
// Architecture:
//   SpreadsheetCompiler  (this file — logic)
//          ↓
//   GridRenderSpec + HeaderNode  (data contract)
//          ↓
//   GenericSpreadsheetTable (UI — imported ONLY by table widgets)

import 'grid_render_spec.dart';
import '../schema/field_schema.dart';

class SpreadsheetCompiler {
  // ─────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────

  static CellSpec _numberCell({
    required String id,
    bool editable = true,
  }) {
    return CellSpec(
      id: id,
      type: CellType.number,
      editable: editable,
    );
  }

  static CellSpec _textCell({
    required String id,
    bool editable = true,
    String? hint,
  }) {
    return CellSpec(
      id: id,
      type: CellType.text,
      editable: editable,
      hint: hint,
    );
  }

  static CellSpec _readOnlyCell({
    required String id,
  }) {
    return CellSpec(
      id: id,
      type: CellType.readOnly,
      editable: false,
    );
  }

  static CellSpec _labelCell({
    required String id,
    required String label,
  }) {
    return CellSpec(
      id: id,
      type: CellType.label,
      editable: false,
      label: label,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // IDENTIFICATION TABLE (2-column form)
  // ─────────────────────────────────────────────────────────────

  static GridRenderSpec compileIdentificationTable({
    required String id,
    required List<List<String>> matrix,
    required List<FieldSchema> fields,
  }) {
    final cellSpecs = <String, CellSpec>{};

    for (final field in fields) {
      cellSpecs['${field.id}_label'] = _labelCell(
        id: '${field.id}_label',
        label: field.label ?? field.id,
      );

      switch (field.type) {
        case 'number':
          cellSpecs[field.id] = _numberCell(id: field.id, editable: true);
          break;
        case 'radio':
          cellSpecs[field.id] = CellSpec(
            id: field.id,
            type: CellType.radio,
            editable: true,
            options: field.options,
          );
          break;
        case 'select':
          cellSpecs[field.id] = CellSpec(
            id: field.id,
            type: CellType.select,
            editable: true,
            options: field.options,
          );
          break;
        default:
          cellSpecs[field.id] = _textCell(
            id: field.id,
            editable: true,
            hint: field.hint,
          );
      }
    }

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: const [],
      headers: const [
        HeaderNode('Champ'),
        HeaderNode('Valeur'),
      ],
      cellSpec: (cellId) {
        final spec = cellSpecs[cellId];
        if (spec == null) {
          return CellSpec(id: cellId, type: CellType.readOnly, editable: false);
        }
        return spec;
      },
      isTotalCell: (_) => false,
      cornerLabel: '',
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. CSP Gender × Age  (S21Q01, S22Q01, S22Q02, S23Q01)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileCspGenderAge({
    required String id,
    required List<List<String>> matrix,
  }) {
    const ageBands = [
      HeaderNode('15-24'),
      HeaderNode('25-34'),
      HeaderNode('35+'),
      HeaderNode('Total'),
    ];

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: const [
        'Cadres / Executives',
        'Agents de Maîtrise / Foremen',
        "Agents d'exécution / Workers",
        'TOTAL',
      ],
      headers: const [
        HeaderNode('Masculin / Male', children: ageBands),
        HeaderNode('Féminin / Female', children: ageBands),
        HeaderNode('TOTAL', highlight: true, children: ageBands),
      ],
      cellSpec: (id) {
        final isTotal = id.contains('_total');
        if (isTotal) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CSP × Status × Gender  (S22Q04, S22Q05)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileCspStatusGender({
    required String id,
    required List<List<String>> matrix,
    required String entityType,
  }) {
    const genderCols = [
      HeaderNode('M'),
      HeaderNode('F'),
      HeaderNode('T'),
    ];

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: entityType == 'enterprise'
          ? const [
              'Déplacés internes / Internal displaced',
              'Réfugiés / Refugees',
              'Orphelins / Orphans',
              'TOTAL',
            ]
          : const [
              'Cadres / Executives',
              'Agents de Maîtrise / Foremen',
              "Agents d'exécution / Workers",
              'TOTAL',
            ],
      headers: const [
        HeaderNode('Permanent', children: genderCols),
        HeaderNode('Temporaire / Temporary', children: genderCols),
        HeaderNode('Total', children: genderCols),
      ],
      cellSpec: (id) {
        final isTotal = id.contains('_total');
        if (isTotal) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Diploma × Gender × Age  (S22Q03)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileDiplomaGenderAge({
    required String id,
    required List<List<String>> matrix,
  }) {
    const ageBands = [
      HeaderNode('15-24'),
      HeaderNode('25-34'),
      HeaderNode('35+'),
      HeaderNode('Total'),
    ];

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: const [
        'CEP/CEPE/FSLC/BEPC/CAP/GCE-OL',
        'PROBATOIRE / Lower Sixth',
        'BAC / GCE-AL',
        'BTS / DUT / HND',
        'Licence (Bac+3) / Bachelor',
        'Maîtrise (Bac+4) / Master 1',
        'Master (Bac+5) / Master 2',
        'DQP / PQD',
        'CQP / CPQ',
        'Autres / Others',
        'Sans diplôme / Without diploma',
        'TOTAL',
      ],
      headers: const [
        HeaderNode('Masculin / Male', children: ageBands),
        HeaderNode('Féminin / Female', children: ageBands),
        HeaderNode('TOTAL', highlight: true, children: ageBands),
      ],
      cellSpec: (id) {
        final isTotal = id.contains('_total');
        if (isTotal) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Departure Table  (S3Q01)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileDeparture({
    required String id,
    required List<List<String>> matrix,
  }) {
    const genderCols = [
      HeaderNode('M'),
      HeaderNode('F'),
      HeaderNode('T'),
    ];

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: const [
        'Cadres / Executives',
        'Agents de Maîtrise / Foremen',
        "Agents d'exécution / Workers",
        'TOTAL',
      ],
      headers: const [
        HeaderNode('Licenciements / Dismissal', children: genderCols),
        HeaderNode('Démissions / Resignation', children: genderCols),
        HeaderNode('Départ retraite / Retirement', children: genderCols),
        HeaderNode('Autres départs / Other', children: genderCols),
        HeaderNode('Ensemble / Whole', children: genderCols),
      ],
      cellSpec: (id) {
        final isTotal = id.contains('_total') || id.contains('_ensemble');
        if (isTotal) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total') || id.contains('_ensemble'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Dismissal + Technical Unemployment  (S3Q03)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileDismissalUnemployment({
    required String id,
    required List<List<String>> matrix,
  }) {
    const genderCols = [
      HeaderNode('M'),
      HeaderNode('F'),
      HeaderNode('T'),
    ];

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: const [
        'Cadres / Executives',
        'Agents de Maîtrise / Foremen',
        "Agents d'exécution / Workers",
        'TOTAL',
      ],
      headers: const [
        HeaderNode('Licenciement / Dismissal', children: genderCols),
        HeaderNode('Chômage technique / Technical unemployment',
            children: genderCols),
        HeaderNode('Total', highlight: true, children: genderCols),
      ],
      cellSpec: (id) {
        final isTotal = id.contains('_total');
        if (isTotal) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 6. First Time Workers  (S23Q02)
  //
  // ALIGNED with FirstTimeWorkersTable._buildMatrix:
  //   4 rows × 24 columns
  //   Rows: cadres, foremen, workers, TOTAL
  //   Columns: PERMANENT (12) + TEMPORAIRE (12)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileFirstTimeWorkers({
    required String id,
    required List<List<String>> matrix,
  }) {
    const ageGenderCols = [
      HeaderNode('M 15-24'),
      HeaderNode('M 25-34'),
      HeaderNode('M 35+'),
      HeaderNode('M-Tot'),
      HeaderNode('F 15-24'),
      HeaderNode('F 25-34'),
      HeaderNode('F 35+'),
      HeaderNode('F-Tot'),
      HeaderNode('T 15-24'),
      HeaderNode('T 25-34'),
      HeaderNode('T 35+'),
      HeaderNode('T-Tot'),
    ];

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: const [
        'Cadres / Executives',
        'Agents de Maîtrise / Foremen',
        "Agents d'exécution / Workers",
        'TOTAL',
      ],
      headers: const [
        HeaderNode('PERMANENT', children: ageGenderCols),
        HeaderNode('TEMPORAIRE', children: ageGenderCols),
      ],
      cellSpec: (id) {
        final isTotal = id.contains('_total') || id.contains('_subtotal');
        if (isTotal) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total') || id.contains('_subtotal'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Internship Table  (S4Q01)
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileInternship({
    required String id,
    required List<List<String>> matrix,
  }) {
    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: const [
        'Stage de vacance / Holiday jobs',
        'Stage académique / Academic internship',
        'Stage professionnelle / Professional internship',
        'Stage pré-emploi / Pre-work internship',
        'TOTAL',
      ],
      headers: const [
        HeaderNode('Sexe / Sex', children: [
          HeaderNode('M'),
          HeaderNode('F'),
          HeaderNode('T'),
        ]),
      ],
      cellSpec: (id) {
        final isTotal = id.contains('_total');
        if (isTotal) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Reasons Table  (S3Q02) — mixed text + numbers
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileReasons({
    required String id,
    required List<List<String>> matrix,
    required int numRows,
  }) {
    final rowLabels = List<String>.generate(
        numRows, (i) => 'Motif ${i + 1} / Reason ${i + 1}')
      ..add('TOTAL');

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: rowLabels,
      headers: const [
        HeaderNode('Motif / Reason'),
        HeaderNode('Sexe / Sex', children: [
          HeaderNode('M'),
          HeaderNode('F'),
          HeaderNode('Total'),
        ]),
      ],
      cellSpec: (id) {
        if (id.contains('_text')) {
          return _textCell(id: id, editable: true, hint: 'Enter reason...');
        }
        if (id.contains('_total')) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Skills Table  (S4Q02) — mixed text + numbers
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileSkills({
    required String id,
    required List<List<String>> matrix,
    required int numRows,
  }) {
    final rowLabels = List<String>.generate(
        numRows, (i) => 'Compétence ${i + 1} / Skill ${i + 1}')
      ..add('TOTAL');

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: rowLabels,
      headers: const [
        HeaderNode('Compétence / Skill'),
        HeaderNode('Sexe / Sex', children: [
          HeaderNode('M'),
          HeaderNode('F'),
          HeaderNode('Total'),
        ]),
      ],
      cellSpec: (id) {
        if (id.contains('_text')) {
          return _textCell(id: id, editable: true, hint: 'Enter skill...');
        }
        if (id.contains('_total')) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 10. Training Table  (S4Q03) — mixed text + numbers
  // ─────────────────────────────────────────────────────────────
  static GridRenderSpec compileTraining({
    required String id,
    required List<List<String>> matrix,
    required int numRows,
  }) {
    final rowLabels = List<String>.generate(
        numRows, (i) => 'Domaine ${i + 1} / Domain ${i + 1}')
      ..add('TOTAL');

    return GridRenderSpec(
      id: id,
      matrix: matrix,
      rowLabels: rowLabels,
      headers: const [
        HeaderNode('Domaine de formation / Training domain'),
        HeaderNode('Sexe / Sex', children: [
          HeaderNode('M'),
          HeaderNode('F'),
          HeaderNode('Total'),
        ]),
      ],
      cellSpec: (id) {
        if (id.contains('_text')) {
          return _textCell(
              id: id, editable: true, hint: 'Enter training domain...');
        }
        if (id.contains('_total')) return _readOnlyCell(id: id);
        return _numberCell(id: id, editable: true);
      },
      isTotalCell: (id) => id.contains('_total'),
    );
  }
}
