// test/register_layout_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dsmo_app/screens/register_widgets.dart';
import 'package:dsmo_app/widgets/public_chrome.dart';

void main() {
  Widget buildTestableWidget({required double width, required Widget child}) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: width,
            child: child,
          ),
        ),
      ),
    );
  }

  testWidgets('FormRow wide layout (>= 560px): 170px label column, 16px gap, red * marker',
      (tester) async {
    await tester.pumpWidget(
      buildTestableWidget(
        width: 600,
        child: const FormRow(
          label: 'Raison sociale',
          required: true,
          hint: 'Nom légal',
          child: SizedBox(key: Key('test_input'), height: 48),
        ),
      ),
    );

    // Verify Row layout exists
    expect(find.byType(Row), findsWidgets);

    // Label column SizedBox has width: 170
    final labelBoxes = tester.widgetList<SizedBox>(find.byType(SizedBox)).where((box) => box.width == 170);
    expect(labelBoxes, isNotEmpty);

    // Gap SizedBox has width: 16
    final gapBoxes = tester.widgetList<SizedBox>(find.byType(SizedBox)).where((box) => box.width == 16);
    expect(gapBoxes, isNotEmpty);

    // Required marker is a red * TextSpan
    final labelFinder = find.byWidgetPredicate(
      (w) => w is Text && w.textSpan?.toPlainText().contains('Raison sociale') == true,
    );
    expect(labelFinder, findsOneWidget);
    final richText = tester.widget<Text>(labelFinder);
    final span = richText.textSpan as TextSpan;
    expect(span.text, 'Raison sociale');
    expect(span.children, isNotNull);
    final starSpan = span.children!.first as TextSpan;
    expect(starSpan.text, ' *');
    expect(starSpan.style?.color, PublicColors.red);

    // Hint text rendered under input
    expect(find.text('Nom légal'), findsOneWidget);
  });

  testWidgets('FormRow narrow layout (< 560px): label stacked above input with 6px gap',
      (tester) async {
    await tester.pumpWidget(
      buildTestableWidget(
        width: 480,
        child: const FormRow(
          label: 'Raison sociale',
          required: true,
          child: SizedBox(key: Key('test_input'), height: 48),
        ),
      ),
    );

    // In narrow layout, no 170px label box
    final labelBoxes = tester.widgetList<SizedBox>(find.byType(SizedBox)).where((box) => box.width == 170);
    expect(labelBoxes, isEmpty);

    // 6px gap between label and input
    final gapBoxes = tester.widgetList<SizedBox>(find.byType(SizedBox)).where((box) => box.height == 6);
    expect(gapBoxes, isNotEmpty);

    // Label is aligned to start
    final richText = tester.widget<Text>(find.byType(Text));
    expect(richText.textAlign, TextAlign.start);
  });
}
