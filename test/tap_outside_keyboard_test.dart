// Throwaway verification for the onTapOutside fix: a touch that starts a
// scroll gesture (a PointerDownEvent outside the focused field's tap
// region) must not close the keyboard. flutter/src/widgets/editable_text.dart
// _EditableTextTapOutsideAction unfocuses unconditionally on desktop
// platforms and, on mobile platforms, only when kIsWeb is true — a
// compile-time constant that's false under `flutter test`, so the exact
// buggy branch can't be exercised here. Forcing TargetPlatform.windows
// exercises the same "call unfocus() by default" code path instead, which
// proves both that this harness genuinely reproduces the dismiss mechanism
// (the unfixed control case loses focus) and that the fix (an explicit
// onTapOutside override) suppresses it.
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show debugDefaultTargetPlatformOverride;
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/shared/number_field.dart';
import 'package:dsmo_app/core/focus/unified_focus_manager_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_engine.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_graph.dart';

UnifiedFocusManagerV2 _emptyFocusManager() => UnifiedFocusManagerV2(NavigationEngine(
      const FormSchemaV2(
        sections: [],
        fields: [],
        grids: [],
        navigation: NavigationGraph(next: {}, prev: {}, gridNeighbors: {}),
      ),
    ));

void main() {
  testWidgets('control: a plain TextField with no onTapOutside DOES lose focus '
      '(proves this harness reproduces the dismiss mechanism)', (tester) async {
    // Reset inline at the end of the test body, not via addTearDown/tearDown:
    // TestWidgetsFlutterBinding checks foundation debug vars are unset
    // immediately after the test body's Future completes, which runs before
    // addTearDown callbacks fire — the same pattern Flutter's own framework
    // tests use (e.g. editable_text_cursor_test.dart).
    debugDefaultTargetPlatformOverride = TargetPlatform.windows;
    final node = FocusNode();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Column(children: [
          TextField(focusNode: node),
          const SizedBox(height: 400, child: Text('outside')),
        ]),
      ),
    ));

    node.requestFocus();
    await tester.pump();
    expect(node.hasFocus, isTrue);

    await tester.tapAt(const Offset(200, 400));
    await tester.pump();

    expect(node.hasFocus, isFalse,
        reason: 'default onTapOutside should unfocus on this platform');

    node.dispose();
    debugDefaultTargetPlatformOverride = null;
  });

  testWidgets('fix: NumberField does NOT lose focus on an outside tap '
      '(simulates the touch that starts a scroll gesture)', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.windows;
    final fm = _emptyFocusManager();
    final cells = ['a'];

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Column(children: [
          SizedBox(
            height: 48,
            width: 200,
            child: NumberField(
              fieldId: 'a',
              value: 0,
              onChanged: (_, __) {},
              focusManager: fm,
              tableId: 't',
              width: 200,
              height: 48,
              allCells: cells,
              rowWidth: 1,
            ),
          ),
          const SizedBox(height: 400, child: Text('outside')),
        ]),
      ),
    ));

    fm.focus('a');
    await tester.pump();
    expect(fm.getNode('a').hasFocus, isTrue);

    await tester.tapAt(const Offset(200, 400));
    await tester.pump();

    expect(fm.getNode('a').hasFocus, isTrue,
        reason: 'onTapOutside override should keep the keyboard open through a scroll touch');

    debugDefaultTargetPlatformOverride = null;
  });
}
