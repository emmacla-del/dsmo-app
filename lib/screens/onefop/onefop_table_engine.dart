// lib/screens/onefop/onefop_table_engine.dart
// ══════════════════════════════════════════════════════════════
// TABLE CELL ID GENERATOR & RECALCULATION DISPATCHER
// ══════════════════════════════════════════════════════════════

import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/utils/table_calculator.dart';

class TableCellEngine {
  static List<String> cellIds(FieldSchema f) {
    final spec = f.tableSpec;
    if (spec == null) return [];
    final tpl = spec['template'] as String? ?? '';
    final pfx = (spec['prefix'] as String? ?? f.id).toLowerCase();
    switch (tpl) {
      case 'csp_gender_age_table':
      case 'csp_table':
        return _cGA(pfx);
      case 'diploma_gender_age_table':
      case 'diploma_table':
        return _cDip(pfx);
      case 'csp_status_gender_table':
      case 'disability_table':
      case 'vulnerable_table':
      case 'vulnerable_csp_rows_table':
        return _cSG(pfx, ['cadres', 'foremen', 'workers']);
      case 'vulnerable_named_rows_table':
        return _cSG(pfx, ['deplaces_internes', 'refugies', 'orphelins']);
      case 'departure_table':
        return _cDep(pfx);
      case 'dismissal_unemployment_table':
        return _cDU(pfx);
      case 'first_time_workers_table':
        return _cFTW(pfx);
      case 'internship_table':
        return _cInt(pfx);
      case 'reasons_table':
        return _cHN(pfx, ['reason_1', 'reason_2', 'reason_3']);
      case 'skills_table':
        return _cHN(pfx, ['skill_1', 'skill_2', 'skill_3']);
      case 'training_table':
        return _cHN(pfx, ['domain_1', 'domain_2', 'domain_3']);
      default:
        return [];
    }
  }

  static List<String> _cGA(String p) {
    const r = ['cadres', 'foremen', 'workers'];
    const g = ['male', 'female'];
    const a = ['15_24', '25_34', '35_plus'];
    return [
      for (final rv in r)
        for (final gv in g)
          for (final av in a) '${p}_${rv}_${gv}_$av'
    ];
  }

  static List<String> _cDip(String p) {
    const d = [
      'cep',
      'bepc',
      'probatoire',
      'bac',
      'bts',
      'licence',
      'maitrise',
      'master',
      'dqp',
      'cqp',
      'autres',
      'sans_diplome'
    ];
    const g = ['male', 'female'];
    const a = ['15_24', '25_34', '35_plus'];
    return [
      for (final dv in d)
        for (final gv in g)
          for (final av in a) '${p}_${dv}_${gv}_$av'
    ];
  }

  static List<String> _cSG(String p, List<String> rows) {
    const s = ['permanent', 'temporary'];
    const g = ['male', 'female'];
    return [
      for (final r in rows)
        for (final sv in s)
          for (final gv in g) '${p}_${r}_${sv}_$gv'
    ];
  }

  static List<String> _cDep(String p) {
    const r = ['cadres', 'foremen', 'workers'];
    const t = ['dismissal', 'resignation', 'retirement', 'other'];
    const g = ['male', 'female'];
    return [
      for (final rv in r)
        for (final tv in t)
          for (final gv in g) '${p}_${rv}_${tv}_$gv'
    ];
  }

  static List<String> _cDU(String p) {
    const r = ['cadres', 'foremen', 'workers'];
    const t = ['dismissal', 'technical_unemployment'];
    const g = ['male', 'female'];
    return [
      for (final rv in r)
        for (final tv in t)
          for (final gv in g) '${p}_${rv}_${tv}_$gv'
    ];
  }

  static List<String> _cFTW(String p) {
    const c = ['permanent', 'temporary'];
    const r = ['cadres', 'foremen', 'workers'];
    const g = ['male', 'female'];
    const a = ['15_24', '25_34', '35_plus'];
    return [
      for (final cv in c)
        for (final rv in r)
          for (final gv in g)
            for (final av in a) '${p}_${cv}_${rv}_${gv}_$av'
    ];
  }

  static List<String> _cInt(String p) {
    const r = ['vacation', 'academic', 'professional', 'pre_employment'];
    const g = ['male', 'female'];
    return [
      for (final rv in r)
        for (final gv in g) '${p}_${rv}_$gv'
    ];
  }

  static List<String> _cHN(String p, List<String> rks) {
    const g = ['male', 'female'];
    return [
      for (final r in rks)
        for (final gv in g) '${p}_${r}_$gv'
    ];
  }

  /// Recompute a single table prefix and return updated grid.
  static Map<String, int> dispatch(Map<String, int> current, String p) {
    Map<String, int> ga(String x) => TableCalculator.recalculateCspGenderAge(
        current: current,
        prefix: x,
        rows: ['cadres', 'foremen', 'workers'],
        genders: ['male', 'female', 'total'],
        ageBands: ['15_24', '25_34', '35_plus']);

    Map<String, int> sg(String x, List<String> r) =>
        TableCalculator.recalculateCspStatusGender(
            current: current,
            prefix: x,
            rows: r,
            statuses: ['permanent', 'temporary'],
            genders: ['male', 'female', 'total']);

    switch (p) {
      case 's21q01':
      case 's22q01':
      case 's22q02':
      case 's23q01':
        return ga(p);
      case 's22q03':
        return TableCalculator.recalculateCspGenderAge(
            current: current,
            prefix: p,
            rows: [
              'cep',
              'bepc',
              'probatoire',
              'bac',
              'bts',
              'licence',
              'maitrise',
              'master',
              'dqp',
              'cqp',
              'autres',
              'sans_diplome'
            ],
            genders: [
              'male',
              'female',
              'total'
            ],
            ageBands: [
              '15_24',
              '25_34',
              '35_plus'
            ]);
      case 's22q04':
        return sg(p, ['cadres', 'foremen', 'workers']);
      case 's22q05_ent':
      case 's22q05_oth':
        return sg(p, ['deplaces_internes', 'refugies', 'orphelins']);
      case 's23q02':
        return TableCalculator.recalculateFirstTimeWorkers(
            current: current,
            prefix: p,
            contractTypes: ['permanent', 'temporary'],
            rows: ['cadres', 'foremen', 'workers'],
            genders: ['male', 'female', 'total'],
            ageBands: ['15_24', '25_34', '35_plus']);
      case 's3q01':
        return TableCalculator.recalculateDeparture(
            current: current,
            prefix: p,
            rows: [
              'cadres',
              'foremen',
              'workers'
            ],
            departureTypes: [
              'dismissal',
              'resignation',
              'retirement',
              'other',
              'ensemble'
            ],
            genders: [
              'male',
              'female',
              'total'
            ]);
      case 's3q02':
        return TableCalculator.recalculateReasons(
            current: current,
            prefix: p,
            reasons: ['reason_1', 'reason_2', 'reason_3'],
            genders: ['male', 'female', 'total']);
      case 's3q03':
        return TableCalculator.recalculateDismissalUnemployment(
            current: current,
            prefix: p,
            rows: ['cadres', 'foremen', 'workers'],
            types: ['dismissal', 'technical_unemployment', 'total'],
            genders: ['male', 'female', 'total']);
      case 's4q01':
        return TableCalculator.recalculateInternship(
            current: current,
            prefix: p,
            rows: ['vacation', 'academic', 'professional', 'pre_employment'],
            genders: ['male', 'female', 'total']);
      case 's4q02':
      case 's4q03':
        return TableCalculator.recalculateSkillsOrTraining(
            current: current,
            prefix: p,
            rows: p == 's4q02'
                ? ['skill_1', 'skill_2', 'skill_3']
                : ['domain_1', 'domain_2', 'domain_3'],
            genders: ['male', 'female', 'total']);
      default:
        return current;
    }
  }
}
