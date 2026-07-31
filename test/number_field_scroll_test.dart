// Throwaway verification for the new scroll-into-view-on-focus behavior
// added to NumberField/FormTextField. Not a permanent regression test.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/shared/number_field.dart';
import 'package:dsmo_app/core/focus/unified_focus_manager_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_engine.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_graph.dart';

void main() {
  testWidgets('focusing an off-screen cell scrolls it into view, keyboard stays attached',
      (tester) async {
    final fm = UnifiedFocusManagerV2(NavigationEngine(const FormSchemaV2(
      sections: [],
      fields: [],
      grids: [],
      navigation: NavigationGraph(next: {}, prev: {}, gridNeighbors: {}),
    )));
    final cells = List.generate(30, (i) => 'cell_$i');
    final scrollController = ScrollController();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          // SingleChildScrollView + Column, not ListView: matches production
          // (MobileCardTable/GenericSpreadsheetTable render every cell of the
          // current page eagerly inside a CustomScrollView's single
          // SliverToBoxAdapter, not a lazily-virtualized sliver list) — every
          // cell's FocusNode is attached to the tree from the first frame,
          // only its scroll position differs.
          body: SingleChildScrollView(
            controller: scrollController,
            child: Column(
              children: [
                for (final id in cells)
                  SizedBox(
                    height: 60,
                    child: NumberField(
                      fieldId: id,
                      value: 0,
                      onChanged: (_, __) {},
                      focusManager: fm,
                      tableId: 't',
                      width: 300,
                      height: 48,
                      allCells: cells,
                      rowWidth: 1,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(scrollController.offset, 0.0);

    // Focus the last cell directly (simulates repeated Enter-to-next-cell
    // landing far below the current scroll position).
    fm.focus('cell_29');
    await tester.pumpAndSettle();

    expect(scrollController.offset, greaterThan(0.0),
        reason: 'focusing an off-screen cell should have scrolled it into view');

    // The focused field must still have an active IME connection (keyboard
    // stays open) rather than losing focus as a side effect of scrolling.
    expect(fm.getNode('cell_29').hasFocus, isTrue);
  });
}
