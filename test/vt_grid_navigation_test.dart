// Coverage for a live-reported gap: "keyboard navigation tabs are not yet
// set for vocational training tables." Traced to form_schema_compiler
// .dart's grid-building step (compile()'s step 4): every non-VT table
// template gets a GridSchema (used for arrow-key cell-to-cell movement —
// Tab itself treats a whole table as one stop, consistently with every
// other table in the app), but every vt_* template fell through to
// `default: return null` in _buildGridFromTableSpec, so VT tables had no
// GridSchema at all and arrow-key navigation inside them silently did
// nothing. Fixed by reusing the real VtTableDef (vtTableDefFor,
// vt_table_defs.dart) to build the grid, instead of re-deriving VT's row/
// cell shape a second time — see _buildVtGrid's own doc comment for why
// that needed extracting vt_row_editor.dart's pure data types into
// vt_table_types.dart first (avoiding a compiler → renderers → screens →
// compiler import cycle).
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/schema/types.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

void main() {
  testWidgets('VT4_1 (fixed diploma table, type: table) has a working grid',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final schema = ctrl.schema!;

    final grid = schema.getGridForField('s4q1_doctorat_male');
    expect(grid, isNotNull, reason: 'VT4_1 should have a GridSchema now');
    expect(grid!.contains('s4q1_doctorat_female'), isTrue);

    // Down from the first diploma row's "male" column lands on the next
    // diploma row's own "male" column — real cell-to-cell movement, not
    // just "the grid exists."
    expect(
      schema.navigation.getGridNeighbor('s4q1_doctorat_male', Direction.down),
      's4q1_master2_male',
    );
    // Right from "male" lands on "female" in the same row.
    expect(
      schema.navigation.getGridNeighbor('s4q1_doctorat_male', Direction.right),
      's4q1_doctorat_female',
    );
  });

  testWidgets(
      'VT4_3 (repeating specialty table, type: repeating_table) has a '
      'working grid too', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final schema = ctrl.schema!;

    final grid = schema.getGridForField('s4q3_row1_specialtyText');
    expect(grid, isNotNull,
        reason: 'VT4_3 (repeating_table) should have a GridSchema too, '
            'not just the fixed-row (table) VT templates');
    expect(
      schema.navigation
          .getGridNeighbor('s4q3_row1_specialtyText', Direction.down),
      's4q3_row2_specialtyText',
    );
    expect(
      schema.navigation
          .getGridNeighbor('s4q3_row1_specialtyText', Direction.right),
      's4q3_row1_fiMale',
    );
  });

  testWidgets('a plain, non-table VT field is correctly absent from any grid',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    // VT1_1 is an ordinary text/select field, not a table — regression
    // guard that the new VT branch doesn't accidentally grid-ify
    // everything in the VT AST.
    expect(ctrl.schema!.getGridForField('VT1_1'), isNull);
  });
}
