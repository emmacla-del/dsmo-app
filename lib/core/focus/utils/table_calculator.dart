// lib/core/focus/utils/table_calculator.dart

class TableCalculator {
  // ─────────────────────────────────────────────────────────────
  // 1. CSP Gender × Age (S21Q01, S22Q01, S22Q02, S23Q01, S22Q03)
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateCspGenderAge({
    required Map<String, int> current,
    required String prefix,
    required List<String> rows,
    required List<String> genders,
    required List<String> ageBands,
  }) {
    final updated = Map<String, int>.from(current);

    // Per-row, per-gender: sum across age bands
    // e.g. s21q01_cadres_male_total = sum of all age bands for male cadres
    for (final row in rows) {
      for (final gender in genders) {
        if (gender == 'total') continue;
        int sum = 0;
        for (final age in ageBands) {
          sum += updated['${prefix}_${row}_${gender}_$age'] ?? 0;
        }
        updated['${prefix}_${row}_${gender}_total'] = sum;
      }
    }

    // 🔥 FIX: Per-row, per-age-band totals (M+F → Total column)
    // This is column 3 in the UI — the Total column for each row/age band
    for (final row in rows) {
      for (final age in ageBands) {
        final maleKey = '${prefix}_${row}_male_$age';
        final femaleKey = '${prefix}_${row}_female_$age';
        final totalKey = '${prefix}_${row}_total_$age';

        final male = updated[maleKey] ?? 0;
        final female = updated[femaleKey] ?? 0;
        updated[totalKey] = male + female;
      }
    }

    // 🔥 FIX: Per-row grand total (sum of per-age totals for gender='total')
    for (final row in rows) {
      int sum = 0;
      for (final age in ageBands) {
        sum += updated['${prefix}_${row}_total_$age'] ?? 0;
      }
      updated['${prefix}_${row}_total_total'] = sum;
    }

    // Column totals per gender per age band (sum across all rows)
    // e.g. s21q01_total_male_15_24
    for (final gender in genders) {
      if (gender == 'total') continue;
      for (final age in ageBands) {
        int sum = 0;
        for (final row in rows) {
          sum += updated['${prefix}_${row}_${gender}_$age'] ?? 0;
        }
        updated['${prefix}_total_${gender}_$age'] = sum;
      }

      // Column total for this gender (all rows, all ages)
      // e.g. s21q01_total_male_total
      int sum = 0;
      for (final age in ageBands) {
        sum += updated['${prefix}_total_${gender}_$age'] ?? 0;
      }
      updated['${prefix}_total_${gender}_total'] = sum;
    }

    // Grand-total column per age band (M+F)
    // e.g. s21q01_total_total_15_24
    for (final age in ageBands) {
      int sum = 0;
      for (final gender in genders) {
        if (gender == 'total') continue;
        sum += updated['${prefix}_total_${gender}_$age'] ?? 0;
      }
      updated['${prefix}_total_total_$age'] = sum;
    }

    // Grand total (all rows, all genders, all ages)
    int grandTotal = 0;
    for (final gender in genders) {
      if (gender == 'total') continue;
      grandTotal += updated['${prefix}_total_${gender}_total'] ?? 0;
    }
    updated['${prefix}_total_total_total'] = grandTotal;

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CSP × Status × Gender
  //    S22Q04 (disability)  — always uses CSP rows for all entities
  //    S22Q05 (vulnerable)  — uses entity-specific rows (dispatched
  //                           from the screen with the correct row list)
  //
  // Cell ID pattern:
  //   <prefix>_<row>_<status>_<gender>
  //   e.g. s22q04_cadres_permanent_male
  //
  // Totals computed:
  //   - Per row, per status: _<row>_<status>_total (M+F → T)
  //   - Per row total per gender: _<row>_total_<gender> (perm+temp)
  //   - Column per status per gender: _total_<status>_<gender>
  //   - Grand total column: _total_total_<gender>
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateCspStatusGender({
    required Map<String, int> current,
    required String prefix,
    required List<String> rows,
    required List<String> statuses,
    required List<String> genders,
  }) {
    final updated = Map<String, int>.from(current);

    for (final row in rows) {
      // Per-row, per-status: gender total (M+F → T)
      for (final status in statuses) {
        int sum = 0;
        for (final gender in genders) {
          if (gender == 'total') continue;
          sum += updated['${prefix}_${row}_${status}_$gender'] ?? 0;
        }
        updated['${prefix}_${row}_${status}_total'] = sum;
      }

      // Per-row status total per gender (permanent + temporary)
      for (final gender in genders) {
        int sum = 0;
        for (final status in statuses) {
          sum += updated['${prefix}_${row}_${status}_$gender'] ?? 0;
        }
        updated['${prefix}_${row}_total_$gender'] = sum;
      }
    }

    // Column totals per status per gender
    for (final status in statuses) {
      for (final gender in genders) {
        int sum = 0;
        for (final row in rows) {
          sum += updated['${prefix}_${row}_${status}_$gender'] ?? 0;
        }
        updated['${prefix}_total_${status}_$gender'] = sum;
      }
    }

    // Grand total column per gender
    for (final gender in genders) {
      int sum = 0;
      for (final status in statuses) {
        sum += updated['${prefix}_total_${status}_$gender'] ?? 0;
      }
      updated['${prefix}_total_total_$gender'] = sum;
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Departure Table (S3Q01)
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateDeparture({
    required Map<String, int> current,
    required String prefix,
    required List<String> rows,
    required List<String> departureTypes,
    required List<String> genders,
  }) {
    final updated = Map<String, int>.from(current);

    for (final row in rows) {
      // Per-row, per-type: gender total (M+F → T)
      for (final type in departureTypes) {
        if (type == 'ensemble') continue;
        int sum = 0;
        for (final gender in genders) {
          if (gender == 'total') continue;
          sum += updated['${prefix}_${row}_${type}_$gender'] ?? 0;
        }
        updated['${prefix}_${row}_${type}_total'] = sum;
      }

      // Ensemble = sum of all non-ensemble types per gender
      for (final gender in genders) {
        int sum = 0;
        for (final type in departureTypes) {
          if (type == 'ensemble') continue;
          sum += updated['${prefix}_${row}_${type}_$gender'] ?? 0;
        }
        updated['${prefix}_${row}_ensemble_$gender'] = sum;
      }
    }

    // Column totals per type per gender
    for (final type in departureTypes) {
      for (final gender in genders) {
        int sum = 0;
        for (final row in rows) {
          sum += updated['${prefix}_${row}_${type}_$gender'] ?? 0;
        }
        updated['${prefix}_total_${type}_$gender'] = sum;
      }
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Dismissal + Technical Unemployment (S3Q03)
  //
  // Cell ID pattern:
  //   <prefix>_<row>_<type>_<gender>
  //   e.g. s3q03_cadres_dismissal_male
  //
  // types = ['dismissal', 'technical_unemployment']
  // The 'total' column is computed, not user-entered.
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateDismissalUnemployment({
    required Map<String, int> current,
    required String prefix,
    required List<String> rows,
    required List<String> types, // includes 'total' as sentinel
    required List<String> genders,
  }) {
    final updated = Map<String, int>.from(current);

    final dataTypes = types.where((t) => t != 'total').toList();

    for (final row in rows) {
      // Per-row, per-type: gender total (M+F → T)
      for (final type in dataTypes) {
        int sum = 0;
        for (final gender in genders) {
          if (gender == 'total') continue;
          sum += updated['${prefix}_${row}_${type}_$gender'] ?? 0;
        }
        updated['${prefix}_${row}_${type}_total'] = sum;
      }

      // Per-row grand total per gender (dismissal + technical_unemployment)
      for (final gender in genders) {
        int sum = 0;
        for (final type in dataTypes) {
          sum += updated['${prefix}_${row}_${type}_$gender'] ?? 0;
        }
        updated['${prefix}_${row}_total_$gender'] = sum;
      }
    }

    // Column totals per type per gender
    for (final type in dataTypes) {
      for (final gender in genders) {
        int sum = 0;
        for (final row in rows) {
          sum += updated['${prefix}_${row}_${type}_$gender'] ?? 0;
        }
        updated['${prefix}_total_${type}_$gender'] = sum;
      }
    }

    // Grand total column per gender
    for (final gender in genders) {
      int sum = 0;
      for (final type in dataTypes) {
        sum += updated['${prefix}_total_${type}_$gender'] ?? 0;
      }
      updated['${prefix}_total_total_$gender'] = sum;
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. First Time Workers (S23Q02)
  //
  // Cell ID pattern:
  //   <prefix>_<contractType>_<row>_<gender>_<age>
  //   e.g. s23q02_permanent_cadres_male_15_24
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateFirstTimeWorkers({
    required Map<String, int> current,
    required String prefix,
    required List<String> contractTypes,
    required List<String> rows,
    required List<String> genders,
    required List<String> ageBands,
  }) {
    final updated = Map<String, int>.from(current);

    for (final contract in contractTypes) {
      // ── 1. Per-row, per-gender: age band total ──
      // e.g. s23q02_permanent_cadres_male_total = sum of ages for male cadres
      for (final row in rows) {
        for (final gender in genders) {
          if (gender == 'total') continue;
          int sum = 0;
          for (final age in ageBands) {
            sum += updated['${prefix}_${contract}_${row}_${gender}_$age'] ?? 0;
          }
          updated['${prefix}_${contract}_${row}_${gender}_total'] = sum;
        }
      }

      // ── 2. 🔥 FIX: Per-row, per-age: gender total (M+F → T) ──
      // e.g. s23q02_permanent_cadres_total_15_24 = male_15_24 + female_15_24
      for (final row in rows) {
        for (final age in ageBands) {
          int sum = 0;
          for (final gender in genders) {
            if (gender == 'total') continue;
            sum += updated['${prefix}_${contract}_${row}_${gender}_$age'] ?? 0;
          }
          updated['${prefix}_${contract}_${row}_total_$age'] = sum;
        }
      }

      // ── 3. 🔥 FIX: Per-row grand total (sum of per-age totals) ──
      // e.g. s23q02_permanent_cadres_total_total = total_15_24 + total_25_34 + total_35_plus
      for (final row in rows) {
        int sum = 0;
        for (final age in ageBands) {
          sum += updated['${prefix}_${contract}_${row}_total_$age'] ?? 0;
        }
        updated['${prefix}_${contract}_${row}_total_total'] = sum;
      }

      // ── 4. Subtotal row per gender per age band ──
      // (sum across all CSP rows for a given contract/gender/age)
      for (final gender in genders) {
        if (gender == 'total') continue;
        for (final age in ageBands) {
          int sum = 0;
          for (final row in rows) {
            sum += updated['${prefix}_${contract}_${row}_${gender}_$age'] ?? 0;
          }
          updated['${prefix}_${contract}_subtotal_${gender}_$age'] = sum;
        }

        // Subtotal row per gender total
        int sum = 0;
        for (final age in ageBands) {
          sum += updated['${prefix}_${contract}_subtotal_${gender}_$age'] ?? 0;
        }
        updated['${prefix}_${contract}_subtotal_${gender}_total'] = sum;
      }

      // ── 5. Subtotal grand-total gender column per age band ──
      for (final age in ageBands) {
        int sum = 0;
        for (final gender in genders) {
          if (gender == 'total') continue;
          sum += updated['${prefix}_${contract}_subtotal_${gender}_$age'] ?? 0;
        }
        updated['${prefix}_${contract}_subtotal_total_$age'] = sum;
      }

      // ── 6. Subtotal grand total ──
      int sum = 0;
      for (final gender in genders) {
        if (gender == 'total') continue;
        sum += updated['${prefix}_${contract}_subtotal_${gender}_total'] ?? 0;
      }
      updated['${prefix}_${contract}_subtotal_total_total'] = sum;
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Internship Table (S4Q01)
  //
  // Cell ID pattern:
  //   <prefix>_<row>_<gender>
  //   e.g. s4q01_vacation_male
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateInternship({
    required Map<String, int> current,
    required String prefix,
    required List<String> rows,
    required List<String> genders,
  }) {
    final updated = Map<String, int>.from(current);

    // Per-row: M+F → T
    for (final row in rows) {
      int sum = 0;
      for (final gender in genders) {
        if (gender == 'total') continue;
        sum += updated['${prefix}_${row}_$gender'] ?? 0;
      }
      updated['${prefix}_${row}_total'] = sum;
    }

    // Column totals per gender
    for (final gender in genders) {
      int sum = 0;
      for (final row in rows) {
        sum += updated['${prefix}_${row}_$gender'] ?? 0;
      }
      updated['${prefix}_total_$gender'] = sum;
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 7. FIX 4 — Reasons Table (S3Q02)
  //
  // PDF structure (3 rows, each with a free-text reason label):
  //   Motif 1 | [text field] | M | F | Total
  //   Motif 2 | [text field] | M | F | Total
  //   Motif 3 | [text field] | M | F | Total
  //   Total   |              | M | F | Total
  //
  // The text label cells (reason_N_text) are stored as strings in _formData
  // via _controllers — they are NOT integer grid cells and are excluded here.
  //
  // Cell ID pattern for numeric cells:
  //   <prefix>_reason_N_<gender>   e.g. s3q02_reason_1_male
  //
  // Totals: per-row M+F→T, column totals per gender.
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateReasons({
    required Map<String, int> current,
    required String prefix,
    required List<String> reasons, // ['reason_1', 'reason_2', 'reason_3']
    required List<String> genders, // ['male', 'female', 'total']
  }) {
    final updated = Map<String, int>.from(current);

    // Per-row: M+F → T
    for (final reason in reasons) {
      int sum = 0;
      for (final gender in genders) {
        if (gender == 'total') continue;
        sum += updated['${prefix}_${reason}_$gender'] ?? 0;
      }
      updated['${prefix}_${reason}_total'] = sum;
    }

    // Column totals per gender
    for (final gender in genders) {
      int sum = 0;
      for (final reason in reasons) {
        sum += updated['${prefix}_${reason}_$gender'] ?? 0;
      }
      updated['${prefix}_total_$gender'] = sum;
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // 8. FIX 3 — Skills & Training Tables (S4Q02, S4Q03)
  //
  // PDF structure — identical for both tables (3 named rows):
  //   S4Q02:  Compétence 1 | [text] | M | F | Total
  //           Compétence 2 | [text] | M | F | Total
  //           Compétence 3 | [text] | M | F | Total
  //           Total        |        | M | F | Total
  //
  //   S4Q03:  Domaine 1 | [text] | M | F | Total
  //           Domaine 2 | [text] | M | F | Total
  //           Domaine 3 | [text] | M | F | Total
  //           Total     |        | M | F | Total
  //
  // There is NO category/level/type breakdown in the PDF —
  // the old 'technical/management/soft × basic/intermediate/advanced'
  // and 'internal/external/online' dimensions were incorrect.
  //
  // Text cells (skill_N_text / domain_N_text) are stored as strings
  // via _controllers, not as integer grid cells.
  //
  // Cell ID pattern for numeric cells:
  //   S4Q02: <prefix>_skill_N_<gender>   e.g. s4q02_skill_1_male
  //   S4Q03: <prefix>_domain_N_<gender>  e.g. s4q03_domain_1_male
  //
  // rows parameter:
  //   S4Q02 → ['skill_1', 'skill_2', 'skill_3']
  //   S4Q03 → ['domain_1', 'domain_2', 'domain_3']
  // ─────────────────────────────────────────────────────────────
  static Map<String, int> recalculateSkillsOrTraining({
    required Map<String, int> current,
    required String prefix,
    required List<String> rows,
    required List<String> genders, // ['male', 'female', 'total']
  }) {
    final updated = Map<String, int>.from(current);

    // Per-row: M+F → T
    for (final row in rows) {
      int sum = 0;
      for (final gender in genders) {
        if (gender == 'total') continue;
        sum += updated['${prefix}_${row}_$gender'] ?? 0;
      }
      updated['${prefix}_${row}_total'] = sum;
    }

    // Column totals per gender
    for (final gender in genders) {
      int sum = 0;
      for (final row in rows) {
        sum += updated['${prefix}_${row}_$gender'] ?? 0;
      }
      updated['${prefix}_total_$gender'] = sum;
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // DEPRECATED — kept for backwards compatibility only.
  // Use recalculateSkillsOrTraining() instead.
  // These will be removed in a future refactor once table_renderer
  // and the AST compiler are updated to use the new method.
  // ─────────────────────────────────────────────────────────────

  /// @deprecated Use [recalculateSkillsOrTraining] with rows=['skill_1','skill_2','skill_3']
  static Map<String, int> recalculateSkills({
    required Map<String, int> current,
    required String prefix,
    required List<String> genders,
  }) {
    return recalculateSkillsOrTraining(
      current: current,
      prefix: prefix,
      rows: ['skill_1', 'skill_2', 'skill_3'],
      genders: genders,
    );
  }

  /// @deprecated Use [recalculateSkillsOrTraining] with rows=['domain_1','domain_2','domain_3']
  static Map<String, int> recalculateTraining({
    required Map<String, int> current,
    required String prefix,
    required List<String> genders,
  }) {
    return recalculateSkillsOrTraining(
      current: current,
      prefix: prefix,
      rows: ['domain_1', 'domain_2', 'domain_3'],
      genders: genders,
    );
  }
}
