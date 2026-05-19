// lib/features/analytics/data/bilan_rh.dart
//
// Data models + Riverpod provider for the Bilan RH endpoint.
// Slot this into your existing analytics feature folder.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../data/api_client.dart';

// ═══════════════════════════════════════════════════════════
// DATA MODELS
// ═══════════════════════════════════════════════════════════

class CspGenderCount {
  final int male;
  final int female;
  final int total;

  const CspGenderCount({
    required this.male,
    required this.female,
    required this.total,
  });

  factory CspGenderCount.fromJson(Map<String, dynamic> j) => CspGenderCount(
        male: (j['male'] as num?)?.toInt() ?? 0,
        female: (j['female'] as num?)?.toInt() ?? 0,
        total: (j['total'] as num?)?.toInt() ?? 0,
      );

  static const zero = CspGenderCount(male: 0, female: 0, total: 0);
}

class CspBreakdown {
  final CspGenderCount executives;
  final CspGenderCount foremen;
  final CspGenderCount workers;
  final CspGenderCount total;

  const CspBreakdown({
    required this.executives,
    required this.foremen,
    required this.workers,
    required this.total,
  });

  factory CspBreakdown.fromJson(Map<String, dynamic> j) => CspBreakdown(
        executives: CspGenderCount.fromJson(
            j['executives'] as Map<String, dynamic>? ?? {}),
        foremen: CspGenderCount.fromJson(
            j['foremen'] as Map<String, dynamic>? ?? {}),
        workers: CspGenderCount.fromJson(
            j['workers'] as Map<String, dynamic>? ?? {}),
        total:
            CspGenderCount.fromJson(j['total'] as Map<String, dynamic>? ?? {}),
      );
}

class VulnerableGroup {
  final int permanent;
  final int temporary;
  final int total;

  const VulnerableGroup({
    required this.permanent,
    required this.temporary,
    required this.total,
  });

  factory VulnerableGroup.fromJson(Map<String, dynamic> j) => VulnerableGroup(
        permanent: (j['permanent'] as num?)?.toInt() ?? 0,
        temporary: (j['temporary'] as num?)?.toInt() ?? 0,
        total: (j['total'] as num?)?.toInt() ?? 0,
      );

  static const zero = VulnerableGroup(permanent: 0, temporary: 0, total: 0);
}

class SkillNeed {
  final int index;
  final String description;
  final int totalCount;

  const SkillNeed({
    required this.index,
    required this.description,
    required this.totalCount,
  });

  factory SkillNeed.fromJson(Map<String, dynamic> j) => SkillNeed(
        index: (j['index'] as num).toInt(),
        description: j['description'] as String? ?? '',
        totalCount: (j['totalCount'] as num?)?.toInt() ?? 0,
      );
}

class TrainingNeed {
  final int index;
  final String domain;
  final int totalCount;

  const TrainingNeed({
    required this.index,
    required this.domain,
    required this.totalCount,
  });

  factory TrainingNeed.fromJson(Map<String, dynamic> j) => TrainingNeed(
        index: (j['index'] as num).toInt(),
        domain: j['domain'] as String? ?? '',
        totalCount: (j['totalCount'] as num?)?.toInt() ?? 0,
      );
}

class DismissalReason {
  final int index;
  final String text;
  final int male;
  final int female;
  final int total;

  const DismissalReason({
    required this.index,
    required this.text,
    required this.male,
    required this.female,
    required this.total,
  });

  factory DismissalReason.fromJson(Map<String, dynamic> j) => DismissalReason(
        index: (j['index'] as num).toInt(),
        text: j['text'] as String? ?? '',
        male: (j['male'] as num?)?.toInt() ?? 0,
        female: (j['female'] as num?)?.toInt() ?? 0,
        total: (j['total'] as num?)?.toInt() ?? 0,
      );
}

class BilanRecruitments {
  final CspBreakdown permanent;
  final CspBreakdown temporary;
  final CspBreakdown combined;

  const BilanRecruitments({
    required this.permanent,
    required this.temporary,
    required this.combined,
  });

  factory BilanRecruitments.fromJson(Map<String, dynamic> j) =>
      BilanRecruitments(
        permanent: CspBreakdown.fromJson(
            j['permanent'] as Map<String, dynamic>? ?? {}),
        temporary: CspBreakdown.fromJson(
            j['temporary'] as Map<String, dynamic>? ?? {}),
        combined:
            CspBreakdown.fromJson(j['combined'] as Map<String, dynamic>? ?? {}),
      );
}

class BilanDepartures {
  final CspGenderCount dismissals;
  final CspGenderCount resignations;
  final CspGenderCount retirements;
  final CspGenderCount others;
  final CspGenderCount total;

  const BilanDepartures({
    required this.dismissals,
    required this.resignations,
    required this.retirements,
    required this.others,
    required this.total,
  });

  factory BilanDepartures.fromJson(Map<String, dynamic> j) => BilanDepartures(
        dismissals: CspGenderCount.fromJson(
            j['dismissals'] as Map<String, dynamic>? ?? {}),
        resignations: CspGenderCount.fromJson(
            j['resignations'] as Map<String, dynamic>? ?? {}),
        retirements: CspGenderCount.fromJson(
            j['retirements'] as Map<String, dynamic>? ?? {}),
        others:
            CspGenderCount.fromJson(j['others'] as Map<String, dynamic>? ?? {}),
        total:
            CspGenderCount.fromJson(j['total'] as Map<String, dynamic>? ?? {}),
      );
}

class BilanVulnerable {
  final VulnerableGroup internalDisplaced;
  final VulnerableGroup refugees;
  final VulnerableGroup orphans;
  final int total;

  const BilanVulnerable({
    required this.internalDisplaced,
    required this.refugees,
    required this.orphans,
    required this.total,
  });

  factory BilanVulnerable.fromJson(Map<String, dynamic> j) => BilanVulnerable(
        internalDisplaced: VulnerableGroup.fromJson(
            j['internalDisplaced'] as Map<String, dynamic>? ?? {}),
        refugees: VulnerableGroup.fromJson(
            j['refugees'] as Map<String, dynamic>? ?? {}),
        orphans: VulnerableGroup.fromJson(
            j['orphans'] as Map<String, dynamic>? ?? {}),
        total: (j['total'] as num?)?.toInt() ?? 0,
      );
}

class SimpleCount {
  final int permanent;
  final int temporary;
  final int total;

  const SimpleCount({
    required this.permanent,
    required this.temporary,
    required this.total,
  });

  factory SimpleCount.fromJson(Map<String, dynamic> j) => SimpleCount(
        permanent: (j['permanent'] as num?)?.toInt() ?? 0,
        temporary: (j['temporary'] as num?)?.toInt() ?? 0,
        total: (j['total'] as num?)?.toInt() ?? 0,
      );
}

class BilanInternships {
  final int holiday;
  final int academic;
  final int professional;
  final int preWork;
  final int total;

  const BilanInternships({
    required this.holiday,
    required this.academic,
    required this.professional,
    required this.preWork,
    required this.total,
  });

  factory BilanInternships.fromJson(Map<String, dynamic> j) => BilanInternships(
        holiday: (j['holiday'] as num?)?.toInt() ?? 0,
        academic: (j['academic'] as num?)?.toInt() ?? 0,
        professional: (j['professional'] as num?)?.toInt() ?? 0,
        preWork: (j['preWork'] as num?)?.toInt() ?? 0,
        total: (j['total'] as num?)?.toInt() ?? 0,
      );
}

// ── Top-level DTO ──────────────────────────────────────────

class BilanRh {
  final int year;
  final String submissionId;
  final String entityType;

  final int permanentWorkers;
  final int vacancies;
  final double vacancyRate;

  final BilanRecruitments recruitments;
  final BilanDepartures departures;
  final double turnoverRate;

  final BilanVulnerable vulnerableWorkers;
  final SimpleCount disabledRecruitments;
  final SimpleCount firstTimeWorkers;
  final BilanInternships internships;

  final List<SkillNeed> skillNeeds;
  final List<TrainingNeed> trainingNeeds;
  final List<DismissalReason> dismissalReasons;

  const BilanRh({
    required this.year,
    required this.submissionId,
    required this.entityType,
    required this.permanentWorkers,
    required this.vacancies,
    required this.vacancyRate,
    required this.recruitments,
    required this.departures,
    required this.turnoverRate,
    required this.vulnerableWorkers,
    required this.disabledRecruitments,
    required this.firstTimeWorkers,
    required this.internships,
    required this.skillNeeds,
    required this.trainingNeeds,
    required this.dismissalReasons,
  });

  factory BilanRh.fromJson(Map<String, dynamic> j) => BilanRh(
        year: (j['year'] as num).toInt(),
        submissionId: j['submissionId'] as String,
        entityType: j['entityType'] as String,
        permanentWorkers: (j['permanentWorkers'] as num).toInt(),
        vacancies: (j['vacancies'] as num?)?.toInt() ?? 0,
        vacancyRate: (j['vacancyRate'] as num?)?.toDouble() ?? 0.0,
        recruitments: BilanRecruitments.fromJson(
            j['recruitments'] as Map<String, dynamic>),
        departures:
            BilanDepartures.fromJson(j['departures'] as Map<String, dynamic>),
        turnoverRate: (j['turnoverRate'] as num?)?.toDouble() ?? 0.0,
        vulnerableWorkers: BilanVulnerable.fromJson(
            j['vulnerableWorkers'] as Map<String, dynamic>),
        disabledRecruitments: SimpleCount.fromJson(
            j['disabledRecruitments'] as Map<String, dynamic>),
        firstTimeWorkers:
            SimpleCount.fromJson(j['firstTimeWorkers'] as Map<String, dynamic>),
        internships:
            BilanInternships.fromJson(j['internships'] as Map<String, dynamic>),
        skillNeeds: (j['skillNeeds'] as List<dynamic>)
            .map((e) => SkillNeed.fromJson(e as Map<String, dynamic>))
            .toList(),
        trainingNeeds: (j['trainingNeeds'] as List<dynamic>)
            .map((e) => TrainingNeed.fromJson(e as Map<String, dynamic>))
            .toList(),
        dismissalReasons: (j['dismissalReasons'] as List<dynamic>)
            .map((e) => DismissalReason.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  // Total recruitments across all CSP
  int get totalRecruitments => recruitments.combined.total.total;

  // Gender split for combined recruitments
  double get femalePct {
    final t = recruitments.combined.total.total;
    if (t == 0) return 0;
    return (recruitments.combined.total.female / t) * 100;
  }
}

// ═══════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════

/// Returns null when the company has no approved submission (locked state).
/// Throws on network errors so the caller can show an error card.
final bilanRhProvider = FutureProvider.family<BilanRh?, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  try {
    final response = await api.get(
      '/dsmo/analytics/bilan',
      queryParameters: {'year': year},
    );
    return BilanRh.fromJson(response.data as Map<String, dynamic>);
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) {
      // No approved submission — show locked state
      return null;
    }
    rethrow;
  }
});
