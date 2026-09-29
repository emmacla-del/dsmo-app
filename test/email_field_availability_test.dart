import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dsmo_app/providers/email_availability_provider.dart';
import 'package:dsmo_app/widgets/email_field_with_availability.dart';

void main() {
  testWidgets('email field does not overflow when backend check fails in a narrow layout',
      (tester) async {
    final controller = TextEditingController();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          emailAvailabilityProvider
              .overrideWith((ref, email) => Future.error(Exception('boom'))),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 220,
                child: EmailFieldWithAvailability(
                  controller: controller,
                  label: 'Email professionnel',
                  onEmailAvailabilityChanged: (_) {},
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextFormField), 'operator@example.com');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();

    expect(tester.takeException(), isNull);
  });
}
