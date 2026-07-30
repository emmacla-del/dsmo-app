// lib/screens/onefop/onefop_coherence_checker.dart
// ══════════════════════════════════════════════════════════════
// Cross-question coherence checks — mirrors checkCoherence() in
// src/questionnaires/questionnaires.service.ts. Flags (never blocks)
// cases where the same underlying count is declared twice, cross-
// tabulated two different ways, and the totals disagree. Runs live
// while the respondent fills the form, purely as a hint — the
// authoritative copy that reaches the reviewer is computed server-side
// at submit time and stored on OnefopSubmission.flags.
// ══════════════════════════════════════════════════════════════

import 'onefop_form_constants.dart' show EntityType;

class CoherenceFlag {
  const CoherenceFlag(this.code, this.message);
  final String code;
  final String message;
}

class OnefopCoherenceChecker {
  static int _n(Map<String, dynamic> data, String key) {
    final v = data[key];
    if (v == null) return 0;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static List<CoherenceFlag> check(
      Map<String, dynamic> data, EntityType entityType) {
    final flags = <CoherenceFlag>[];
    int n(String key) => _n(data, key);

    // Recruitments (S22Q01 permanent + S22Q02 temporary) re-partitioned by
    // diploma instead of age in S22Q03 — same recruited population, the
    // grand totals must agree, overall and per gender.
    final byAge = {
      'male': n('s22q01_total_male_total') + n('s22q02_total_male_total'),
      'female':
          n('s22q01_total_female_total') + n('s22q02_total_female_total'),
      'total': n('s22q01_total_total_total') + n('s22q02_total_total_total'),
    };
    final byDiploma = {
      'male': n('s22q03_total_male_total'),
      'female': n('s22q03_total_female_total'),
      'total': n('s22q03_total_total_total'),
    };
    for (final gender in ['male', 'female', 'total']) {
      final a = byAge[gender]!;
      final b = byDiploma[gender]!;
      if (a != b && (a > 0 || b > 0)) {
        flags.add(CoherenceFlag(
          'S22Q03_DIPLOMA_MISMATCH',
          'Répartition des recrutements par diplôme (S22Q03: $b, $gender) '
              'ne correspond pas au total des recrutements permanents + '
              'temporaires (S22Q01+S22Q02: $a, $gender).',
        ));
      }
    }

    // Dismissals appear in three different tables — the departures table
    // (S3Q01, "dismissal" column), the dismissal-reasons table (S3Q02), and
    // the dismissal/technical-unemployment table (S3Q03, "dismissal"
    // column) — all three describe the same dismissals and should agree.
    for (final gender in ['male', 'female']) {
      final a = n('s3q01_total_dismissal_$gender');
      final b = n('s3q02_total_$gender');
      final c = n('s3q03_total_dismissal_$gender');
      if ({a, b, c}.length > 1 && (a > 0 || b > 0 || c > 0)) {
        flags.add(CoherenceFlag(
          'S3_DISMISSAL_MISMATCH',
          'Le nombre de licenciements ($gender) diffère entre S3Q01 ($a), '
              'S3Q02 ($b) et S3Q03 ($c).',
        ));
      }
    }

    // Disability/vulnerable/first-time recruits are each a subset of total
    // recruits, and S22Q04/S22Q05/S23Q02 all share the same permanent-vs-
    // temporary split as S22Q01/S22Q02 — so the check is tightened to
    // per-status rather than just the combined total, catching e.g. a
    // company reporting more disabled PERMANENT recruits than permanent
    // recruits overall even if it's offset by fewer on the temporary side.
    final vulnPrefix =
        entityType == EntityType.enterprise ? 's22q05_ent' : 's22q05_oth';
    for (final gender in ['male', 'female']) {
      final permanentRecruits = n('s22q01_total_${gender}_total');
      final temporaryRecruits = n('s22q02_total_${gender}_total');

      final disabilityPermanent = n('s22q04_total_permanent_$gender');
      final disabilityTemporary = n('s22q04_total_temporary_$gender');
      if (disabilityPermanent > permanentRecruits) {
        flags.add(CoherenceFlag(
          'S22Q04_PERMANENT_EXCEEDS_TOTAL',
          'Recrutements permanents de personnes en situation de handicap '
              '(S22Q04: $disabilityPermanent, $gender) supérieurs au total '
              'des recrutements permanents (S22Q01: $permanentRecruits, '
              '$gender).',
        ));
      }
      if (disabilityTemporary > temporaryRecruits) {
        flags.add(CoherenceFlag(
          'S22Q04_TEMPORARY_EXCEEDS_TOTAL',
          'Recrutements temporaires de personnes en situation de handicap '
              '(S22Q04: $disabilityTemporary, $gender) supérieurs au total '
              'des recrutements temporaires (S22Q02: $temporaryRecruits, '
              '$gender).',
        ));
      }

      final vulnerablePermanent = n('${vulnPrefix}_total_permanent_$gender');
      final vulnerableTemporary = n('${vulnPrefix}_total_temporary_$gender');
      if (vulnerablePermanent > permanentRecruits) {
        flags.add(CoherenceFlag(
          'S22Q05_PERMANENT_EXCEEDS_TOTAL',
          'Recrutements permanents de personnes vulnérables (S22Q05: '
              '$vulnerablePermanent, $gender) supérieurs au total des '
              'recrutements permanents (S22Q01: $permanentRecruits, '
              '$gender).',
        ));
      }
      if (vulnerableTemporary > temporaryRecruits) {
        flags.add(CoherenceFlag(
          'S22Q05_TEMPORARY_EXCEEDS_TOTAL',
          'Recrutements temporaires de personnes vulnérables (S22Q05: '
              '$vulnerableTemporary, $gender) supérieurs au total des '
              'recrutements temporaires (S22Q02: $temporaryRecruits, '
              '$gender).',
        ));
      }

      // S23Q02 "first-time workers recruited" is, by definition, a subset
      // of all recruits — can't recruit a first-time permanent worker
      // without it counting as a permanent recruit in S22Q01, same for
      // temporary/S22Q02.
      final firstTimePermanent =
          n('s23q02_permanent_subtotal_${gender}_total');
      final firstTimeTemporary =
          n('s23q02_temporary_subtotal_${gender}_total');
      if (firstTimePermanent > permanentRecruits) {
        flags.add(CoherenceFlag(
          'S23Q02_PERMANENT_EXCEEDS_TOTAL',
          'Primo-demandeurs recrutés en permanent (S23Q02: '
              '$firstTimePermanent, $gender) supérieurs au total des '
              'recrutements permanents (S22Q01: $permanentRecruits, '
              '$gender).',
        ));
      }
      if (firstTimeTemporary > temporaryRecruits) {
        flags.add(CoherenceFlag(
          'S23Q02_TEMPORARY_EXCEEDS_TOTAL',
          'Primo-demandeurs recrutés en temporaire (S23Q02: '
              '$firstTimeTemporary, $gender) supérieurs au total des '
              'recrutements temporaires (S22Q02: $temporaryRecruits, '
              '$gender).',
        ));
      }
    }

    // Headline sanity ceiling — catches a stray extra digit typo.
    final workersFieldId = switch (entityType) {
      EntityType.enterprise => 'S1Q10',
      EntityType.cooperative => 'COOP_S1Q11',
      EntityType.ctd => 'CTD_S1Q09',
      EntityType.ong => 'ONG_S1Q10',
    };
    final vacanciesFieldId = switch (entityType) {
      EntityType.enterprise => 'S1Q11',
      EntityType.cooperative => 'COOP_S1Q12',
      EntityType.ctd => 'CTD_S1Q10',
      EntityType.ong => 'ONG_S1Q11',
    };
    final workers = n(workersFieldId);
    final vacancies = n(vacanciesFieldId);
    if (workers > 50000) {
      flags.add(CoherenceFlag(
        'PERMANENT_WORKERS_IMPLAUSIBLE',
        'Effectif permanent déclaré très élevé ($workers) — merci de '
            'vérifier.',
      ));
    }
    if (vacancies > 50000) {
      flags.add(CoherenceFlag(
        'VACANCIES_IMPLAUSIBLE',
        'Nombre de postes vacants déclaré très élevé ($vacancies) — merci '
            'de vérifier.',
      ));
    }

    return flags;
  }
}
