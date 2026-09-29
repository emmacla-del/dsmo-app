// VT-7 regression coverage: exactly one vocational-training signup option
// ("Vocational Training Center (ONEFOP survey)" → EntityType.vocationalTraining)
// is offered in the registration catalog. The non-ONEFOP
// "Vocational Training Center (not part of ONEFOP survey)" option
// (formerly EntityType.vocationalCenter) must not be offered — the
// underlying Prisma enum value VOCATIONAL_TRAINING_CENTER is kept
// (Postgres enum values can't be dropped without a table rewrite) but no
// app code writes or reads it anymore, so there is nothing left in
// EntityType for this test to reference directly; the assertions below
// confirm that catalog-level absence instead.
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/data/minefop_models.dart';
import 'package:dsmo_app/screens/register_constants.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('exactly one vocational-training entry exists in the catalog, and it '
      'maps to VOCATIONAL_TRAINING', () {
    final vtEntries = EntityType.values.where((t) =>
        t.apiValue.toUpperCase().contains('VOCATIONAL'));
    expect(vtEntries.length, 1,
        reason: 'the non-ONEFOP vocational-training-center option must not '
            'exist as a separate catalog entry');
    expect(vtEntries.single, EntityType.vocationalTraining);
    expect(vtEntries.single.apiValue, 'VOCATIONAL_TRAINING');
  });

  test('the ONEFOP vocational-training option is registerable (has an '
      'EntityConfig)', () {
    expect(entityConfigs[EntityType.vocationalTraining], isNotNull);
  });

  test('no EntityConfig in the catalog is titled as the non-ONEFOP variant',
      () {
    for (final config in entityConfigs.values) {
      expect(config.title.fr.contains('hors enquête ONEFOP'), isFalse);
      expect(config.title.en.contains('not part of ONEFOP survey'), isFalse);
    }
  });
}
