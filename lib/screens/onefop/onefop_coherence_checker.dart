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

import '../../core/i18n/localized_text.dart';
import 'onefop_form_constants.dart' show EntityType;

class CoherenceFlag {
  const CoherenceFlag(this.code, this.message, this.fieldId);
  final String code;
  final LocalizedText message;
  // The field the message names first — where a tap should jump to.
  final String fieldId;
}

class OnefopCoherenceChecker {
  static int _n(Map<String, dynamic> data, String key) {
    final v = data[key];
    if (v == null) return 0;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  // Raw data keys are 'male'/'female'/'total' — kept as the map key but
  // given a display label per language when interpolated into messages.
  static const _genderLabels = {
    'male': LocalizedText(fr: 'Homme', en: 'Male'),
    'female': LocalizedText(fr: 'Femme', en: 'Female'),
    'total': LocalizedText.same('Total'),
  };

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
        final gFr = _genderLabels[gender]!.fr;
        final gEn = _genderLabels[gender]!.en;
        flags.add(CoherenceFlag(
          'S22Q03_DIPLOMA_MISMATCH',
          LocalizedText(
            fr: 'Répartition des recrutements par diplôme (S22Q03: $b, '
                '$gFr) ne correspond pas au total des recrutements '
                'permanents + temporaires (S22Q01+S22Q02: $a, $gFr).',
            en: 'Recruitment breakdown by diploma (S22Q03: $b, $gEn) does '
                'not match the total permanent + temporary recruitments '
                '(S22Q01+S22Q02: $a, $gEn).',
          ),
          'S22Q03',
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
        final gFr = _genderLabels[gender]!.fr;
        final gEn = _genderLabels[gender]!.en;
        flags.add(CoherenceFlag(
          'S3_DISMISSAL_MISMATCH',
          LocalizedText(
            fr: 'Le nombre de licenciements ($gFr) diffère entre S3Q01 '
                '($a), S3Q02 ($b) et S3Q03 ($c).',
            en: 'The number of dismissals ($gEn) differs between S3Q01 '
                '($a), S3Q02 ($b) and S3Q03 ($c).',
          ),
          'S3Q01',
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
    final vulnFieldId = entityType == EntityType.enterprise
        ? 'S22Q05_ENTERPRISE'
        : 'S22Q05_OTHER';
    for (final gender in ['male', 'female']) {
      final gFr = _genderLabels[gender]!.fr;
      final gEn = _genderLabels[gender]!.en;
      final permanentRecruits = n('s22q01_total_${gender}_total');
      final temporaryRecruits = n('s22q02_total_${gender}_total');

      final disabilityPermanent = n('s22q04_total_permanent_$gender');
      final disabilityTemporary = n('s22q04_total_temporary_$gender');
      if (disabilityPermanent > permanentRecruits) {
        flags.add(CoherenceFlag(
          'S22Q04_PERMANENT_EXCEEDS_TOTAL',
          LocalizedText(
            fr: 'Recrutements permanents de personnes en situation de '
                'handicap (S22Q04: $disabilityPermanent, $gFr) supérieurs '
                'au total des recrutements permanents (S22Q01: '
                '$permanentRecruits, $gFr).',
            en: 'Permanent recruitments of people with disabilities '
                '(S22Q04: $disabilityPermanent, $gEn) exceed the total '
                'permanent recruitments (S22Q01: $permanentRecruits, '
                '$gEn).',
          ),
          'S22Q04',
        ));
      }
      if (disabilityTemporary > temporaryRecruits) {
        flags.add(CoherenceFlag(
          'S22Q04_TEMPORARY_EXCEEDS_TOTAL',
          LocalizedText(
            fr: 'Recrutements temporaires de personnes en situation de '
                'handicap (S22Q04: $disabilityTemporary, $gFr) supérieurs '
                'au total des recrutements temporaires (S22Q02: '
                '$temporaryRecruits, $gFr).',
            en: 'Temporary recruitments of people with disabilities '
                '(S22Q04: $disabilityTemporary, $gEn) exceed the total '
                'temporary recruitments (S22Q02: $temporaryRecruits, '
                '$gEn).',
          ),
          'S22Q04',
        ));
      }

      final vulnerablePermanent = n('${vulnPrefix}_total_permanent_$gender');
      final vulnerableTemporary = n('${vulnPrefix}_total_temporary_$gender');
      if (vulnerablePermanent > permanentRecruits) {
        flags.add(CoherenceFlag(
          'S22Q05_PERMANENT_EXCEEDS_TOTAL',
          LocalizedText(
            fr: 'Recrutements permanents de personnes vulnérables '
                '(S22Q05: $vulnerablePermanent, $gFr) supérieurs au total '
                'des recrutements permanents (S22Q01: $permanentRecruits, '
                '$gFr).',
            en: 'Permanent recruitments of vulnerable people (S22Q05: '
                '$vulnerablePermanent, $gEn) exceed the total permanent '
                'recruitments (S22Q01: $permanentRecruits, $gEn).',
          ),
          vulnFieldId,
        ));
      }
      if (vulnerableTemporary > temporaryRecruits) {
        flags.add(CoherenceFlag(
          'S22Q05_TEMPORARY_EXCEEDS_TOTAL',
          LocalizedText(
            fr: 'Recrutements temporaires de personnes vulnérables '
                '(S22Q05: $vulnerableTemporary, $gFr) supérieurs au total '
                'des recrutements temporaires (S22Q02: $temporaryRecruits, '
                '$gFr).',
            en: 'Temporary recruitments of vulnerable people (S22Q05: '
                '$vulnerableTemporary, $gEn) exceed the total temporary '
                'recruitments (S22Q02: $temporaryRecruits, $gEn).',
          ),
          vulnFieldId,
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
          LocalizedText(
            fr: 'Primo-demandeurs recrutés en permanent (S23Q02: '
                '$firstTimePermanent, $gFr) supérieurs au total des '
                'recrutements permanents (S22Q01: $permanentRecruits, '
                '$gFr).',
            en: 'First-time job seekers recruited as permanent staff '
                '(S23Q02: $firstTimePermanent, $gEn) exceed the total '
                'permanent recruitments (S22Q01: $permanentRecruits, '
                '$gEn).',
          ),
          'S23Q02',
        ));
      }
      if (firstTimeTemporary > temporaryRecruits) {
        flags.add(CoherenceFlag(
          'S23Q02_TEMPORARY_EXCEEDS_TOTAL',
          LocalizedText(
            fr: 'Primo-demandeurs recrutés en temporaire (S23Q02: '
                '$firstTimeTemporary, $gFr) supérieurs au total des '
                'recrutements temporaires (S22Q02: $temporaryRecruits, '
                '$gFr).',
            en: 'First-time job seekers recruited as temporary staff '
                '(S23Q02: $firstTimeTemporary, $gEn) exceed the total '
                'temporary recruitments (S22Q02: $temporaryRecruits, '
                '$gEn).',
          ),
          'S23Q02',
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
        LocalizedText(
          fr: 'Effectif permanent déclaré très élevé ($workers) — merci '
              'de vérifier.',
          en: 'Declared permanent headcount is very high ($workers) — '
              'please double-check.',
        ),
        workersFieldId,
      ));
    }
    if (vacancies > 50000) {
      flags.add(CoherenceFlag(
        'VACANCIES_IMPLAUSIBLE',
        LocalizedText(
          fr: 'Nombre de postes vacants déclaré très élevé ($vacancies) — '
              'merci de vérifier.',
          en: 'Declared number of vacancies is very high ($vacancies) — '
              'please double-check.',
        ),
        vacanciesFieldId,
      ));
    }

    return flags;
  }
}
