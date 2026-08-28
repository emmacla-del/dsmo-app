// Phase 2 P0 fix regression coverage: OnefopCoherenceChecker's
// S22Q03_DIPLOMA_MISMATCH and S3_DISMISSAL_MISMATCH checks referenced
// S22Q02/S22Q03/S3Q03 — fields Administration's schema excludes entirely
// (see onefop_ast.dart) — without gating on entityType, so they used to
// spuriously flag every Administration submission with real S22Q01 or
// S3Q01/S3Q02 data. This proves the guard and confirms the existing four
// entity types keep their original (unguarded) behavior.
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_coherence_checker.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart'
    show EntityType;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Administration — false positives suppressed', () {
    test('S22Q03_DIPLOMA_MISMATCH does not fire despite real S22Q01 data '
        'and absent S22Q02/S22Q03', () {
      final data = {
        's22q01_total_male_total': 5,
        's22q01_total_female_total': 3,
        's22q01_total_total_total': 8,
        // S22Q02/S22Q03 absent for administration — reads as 0.
      };
      final flags =
          OnefopCoherenceChecker.check(data, EntityType.administration);
      expect(flags.any((f) => f.code == 'S22Q03_DIPLOMA_MISMATCH'), isFalse);
    });

    test('S3_DISMISSAL_MISMATCH does not fire despite real S3Q01/S3Q02 '
        'data and absent S3Q03', () {
      final data = {
        's3q01_total_dismissal_male': 4,
        's3q02_total_male': 4,
        // S3Q03 absent for administration — reads as 0, would otherwise
        // permanently mismatch against a and b above.
      };
      final flags =
          OnefopCoherenceChecker.check(data, EntityType.administration);
      expect(flags.any((f) => f.code == 'S3_DISMISSAL_MISMATCH'), isFalse);
    });
  });

  group('Enterprise — existing behavior unchanged', () {
    test('S22Q03_DIPLOMA_MISMATCH still fires on a genuine mismatch', () {
      final data = {
        's22q01_total_male_total': 5,
        's22q02_total_male_total': 3,
        's22q03_total_male_total': 6, // should be 8, mismatched
      };
      final flags =
          OnefopCoherenceChecker.check(data, EntityType.enterprise);
      expect(flags.any((f) => f.code == 'S22Q03_DIPLOMA_MISMATCH'), isTrue);
    });

    test('S3_DISMISSAL_MISMATCH still fires on a genuine mismatch', () {
      final data = {
        's3q01_total_dismissal_male': 4,
        's3q02_total_male': 4,
        's3q03_total_dismissal_male': 2, // mismatched
      };
      final flags =
          OnefopCoherenceChecker.check(data, EntityType.enterprise);
      expect(flags.any((f) => f.code == 'S3_DISMISSAL_MISMATCH'), isTrue);
    });

    test('neither check fires when all three tables agree', () {
      final data = {
        's22q01_total_male_total': 5,
        's22q02_total_male_total': 3,
        's22q03_total_male_total': 8,
        's3q01_total_dismissal_male': 4,
        's3q02_total_male': 4,
        's3q03_total_dismissal_male': 4,
      };
      final flags =
          OnefopCoherenceChecker.check(data, EntityType.enterprise);
      expect(flags.any((f) => f.code == 'S22Q03_DIPLOMA_MISMATCH'), isFalse);
      expect(flags.any((f) => f.code == 'S3_DISMISSAL_MISMATCH'), isFalse);
    });
  });
}
