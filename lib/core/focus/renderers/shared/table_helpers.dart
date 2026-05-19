// lib/core/focus/renderers/shared/table_helpers.dart

class TableHelpers {
  static String getGenderLabel(String gender) {
    switch (gender) {
      case 'male':
        return 'Hommes';
      case 'female':
        return 'Femmes';
      case 'total':
        return 'Total';
      default:
        return gender;
    }
  }

  static String getShortGenderLabel(String gender) {
    switch (gender) {
      case 'male':
        return 'H';
      case 'female':
        return 'F';
      case 'total':
        return 'T';
      default:
        return gender;
    }
  }

  static String getAgeBandLabel(String band) {
    switch (band) {
      case '15_24':
        return '15-24 ans';
      case '25_34':
        return '25-34 ans';
      case '35_plus':
        return '35 ans+';
      default:
        return band;
    }
  }

  static String getShortAgeBandLabel(String band) {
    switch (band) {
      case '15_24':
        return '15-24';
      case '25_34':
        return '25-34';
      case '35_plus':
        return '35+';
      default:
        return band;
    }
  }

  static String getCSPLabel(String csp) {
    switch (csp) {
      case 'cadres':
        return 'Cadres / Managers';
      case 'foremen':
        return 'Agents de maîtrise / Foremen';
      case 'workers':
        return 'Agents d\'exécution / Workers';
      default:
        return csp;
    }
  }

  static String getShortCSPLabel(String csp) {
    switch (csp) {
      case 'cadres':
        return 'Cadres';
      case 'foremen':
        return 'Agents de maîtrise';
      case 'workers':
        return 'Agents d\'exécution';
      default:
        return csp;
    }
  }

  static String getStatusLabel(String status) {
    switch (status) {
      case 'permanent':
        return 'Permanent';
      case 'temporary':
        return 'Temporaire';
      default:
        return status;
    }
  }

  static String getDepartureTypeLabel(String type) {
    switch (type) {
      case 'dismissal':
        return 'Licenciements';
      case 'resignation':
        return 'Démissions';
      case 'retirement':
        return 'Retraite';
      case 'other':
        return 'Autres';
      case 'ensemble':
        return 'Ensemble';
      default:
        return type;
    }
  }

  static String getDismissalTypeLabel(String type) {
    switch (type) {
      case 'dismissal':
        return 'Licenciement';
      case 'technical_unemployment':
        return 'Chômage technique';
      default:
        return type;
    }
  }

  static String sanitizeKey(String text) {
    return text
        .replaceAll(' ', '_')
        .replaceAll('/', '_')
        .replaceAll('(', '')
        .replaceAll(')', '')
        .replaceAll('+', 'plus')
        .replaceAll('-', '_')
        .replaceAll("'", '')
        .toLowerCase();
  }

  static List<String> getRows(
      Map<String, dynamic> spec, List<String> defaultRows) {
    final rows = spec['rows'] as List<String>?;
    if (rows != null && rows.isNotEmpty) return rows;
    if (spec['rows'] is int) {
      final count = spec['rows'] as int;
      return List.generate(count, (i) => 'row_${i + 1}');
    }
    return defaultRows;
  }

  static List<String> getGenders(
      Map<String, dynamic> spec, List<String> defaultGenders) {
    return spec['genders'] as List<String>? ?? defaultGenders;
  }

  static List<String> getAgeBands(
      Map<String, dynamic> spec, List<String> defaultBands) {
    return spec['age_bands'] as List<String>? ?? defaultBands;
  }

  static List<String> getStatuses(
      Map<String, dynamic> spec, List<String> defaultStatuses) {
    return spec['statuses'] as List<String>? ?? defaultStatuses;
  }

  static List<String> getDepartureTypes(
      Map<String, dynamic> spec, List<String> defaultTypes) {
    return spec['departure_types'] as List<String>? ?? defaultTypes;
  }
}
