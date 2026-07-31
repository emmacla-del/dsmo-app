// Throwaway verification for the cursor-vertical-centering fix: an
// isDense+zero-padding TextField collapses to its intrinsic (single-line)
// height and pins to the TOP of whatever height its ancestor gives it —
// textAlignVertical.center only centers text *within* that collapsed box,
// not the box itself within the cell. NumberField/FormTextField/
// HybridNumericCell now wrap the TextField in a Center to fix this.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/shared/number_field.dart';
import 'package:dsmo_app/core/focus/unified_focus_manager_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_engine.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_graph.dart';

void main() {
  testWidgets('NumberField caret is centered both horizontally and vertically in its cell',
      (tester) async {
    final fm = UnifiedFocusManagerV2(NavigationEngine(const FormSchemaV2(
      sections: [],
      fields: [],
      grids: [],
      navigation: NavigationGraph(next: {}, prev: {}, gridNeighbors: {}),
    )));
    const cellWidth = 200.0;
    const cellHeight = 48.0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: cellWidth,
              height: cellHeight,
              child: NumberField(
                fieldId: 'a',
                value: 0,
                onChanged: (_, __) {},
                focusManager: fm,
                tableId: 't',
                width: cellWidth,
                height: cellHeight,
                allCells: const ['a'],
                rowWidth: 1,
              ),
            ),
          ),
        ),
      ),
    );

    fm.focus('a');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600)); // let caret blink-on
    expect(fm.getNode('a').hasFocus, isTrue);

    final editableTextState = tester.state<EditableTextState>(find.byType(EditableText));
    final renderEditable = editableTextState.renderEditable;
    final caretLocal = renderEditable.getLocalRectForCaret(const TextPosition(offset: 0));
    final caretGlobal = renderEditable.localToGlobal(caretLocal.center);

    final cellCenter = tester.getCenter(find.byType(SizedBox).first);

    expect(caretGlobal.dx, closeTo(cellCenter.dx, 1.0),
        reason: 'caret should be horizontally centered in the cell');
    expect(caretGlobal.dy, closeTo(cellCenter.dy, 1.0),
        reason: 'caret should be vertically centered in the cell, not pinned to the top');
  });
}
