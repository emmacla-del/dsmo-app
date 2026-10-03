// lib/screens/register_state.dart

import '../data/minefop_models.dart';
import 'register_constants.dart';

/// Immutable snapshot of registration wizard state.
class RegState {
  final EntityType? entityType;
  final String respondentFirstName;
  final String respondentLastName;
  final String respondentFunction;
  final String respondentEmail;
  final String respondentPhone1;
  final String respondentPhone2;
  final bool emailIsAvailable;
  final Map<String, dynamic> entityData;
  final Map<String, dynamic>? selectedRegion;
  final Map<String, dynamic>? selectedDepartment;
  final Map<String, dynamic>? selectedSubdivision;
  final String? selectedArea;
  final Map<String, dynamic>? selectedSector;
  final List<dynamic> subdivisions;
  final bool loadingSubdivisions;
  final String password;
  final bool isSecurityValid;

  const RegState({
    this.entityType,
    this.respondentFirstName = '',
    this.respondentLastName = '',
    this.respondentFunction = '',
    this.respondentEmail = '',
    this.respondentPhone1 = '',
    this.respondentPhone2 = '',
    this.emailIsAvailable = true,
    this.entityData = const {},
    this.selectedRegion,
    this.selectedDepartment,
    this.selectedSubdivision,
    this.selectedArea,
    this.selectedSector,
    this.subdivisions = const [],
    this.loadingSubdivisions = false,
    this.password = '',
    this.isSecurityValid = false,
  });

  RegState copyWith({
    EntityType? entityType,
    bool clearEntityType = false,
    String? respondentFirstName,
    String? respondentLastName,
    String? respondentFunction,
    String? respondentEmail,
    String? respondentPhone1,
    String? respondentPhone2,
    bool? emailIsAvailable,
    Map<String, dynamic>? entityData,
    Map<String, dynamic>? selectedRegion,
    bool clearRegion = false,
    Map<String, dynamic>? selectedDepartment,
    bool clearDepartment = false,
    Map<String, dynamic>? selectedSubdivision,
    bool clearSubdivision = false,
    String? selectedArea,
    bool clearArea = false,
    Map<String, dynamic>? selectedSector,
    bool clearSector = false,
    List<dynamic>? subdivisions,
    bool? loadingSubdivisions,
    String? password,
    bool? isSecurityValid,
  }) {
    return RegState(
      entityType: clearEntityType ? null : (entityType ?? this.entityType),
      respondentFirstName: respondentFirstName ?? this.respondentFirstName,
      respondentLastName: respondentLastName ?? this.respondentLastName,
      respondentFunction: respondentFunction ?? this.respondentFunction,
      respondentEmail: respondentEmail ?? this.respondentEmail,
      respondentPhone1: respondentPhone1 ?? this.respondentPhone1,
      respondentPhone2: respondentPhone2 ?? this.respondentPhone2,
      emailIsAvailable: emailIsAvailable ?? this.emailIsAvailable,
      entityData: entityData ?? this.entityData,
      selectedRegion:
          clearRegion ? null : (selectedRegion ?? this.selectedRegion),
      selectedDepartment: clearDepartment
          ? null
          : (selectedDepartment ?? this.selectedDepartment),
      selectedSubdivision: clearSubdivision
          ? null
          : (selectedSubdivision ?? this.selectedSubdivision),
      selectedArea: clearArea ? null : (selectedArea ?? this.selectedArea),
      selectedSector:
          clearSector ? null : (selectedSector ?? this.selectedSector),
      subdivisions: subdivisions ?? this.subdivisions,
      loadingSubdivisions: loadingSubdivisions ?? this.loadingSubdivisions,
      password: password ?? this.password,
      isSecurityValid: isSecurityValid ?? this.isSecurityValid,
    );
  }
}

/// Pure section completeness evaluation, computed from state without triggering
/// validation error UI.
bool isSectionComplete(int step, RegState s) {
  switch (step) {
    case kStepEntityType:
      return s.entityType != null;

    case kStepRespondent:
      return s.respondentFirstName.trim().isNotEmpty &&
          s.respondentLastName.trim().isNotEmpty &&
          s.respondentFunction.trim().isNotEmpty &&
          s.respondentEmail.trim().isNotEmpty &&
          s.respondentPhone1.trim().isNotEmpty &&
          s.emailIsAvailable;

    case kStepEntityInfo:
      if (s.entityType == null) return false;
      final config = entityConfigs[s.entityType];
      if (config == null) return false;
      for (final field in config.fields) {
        if (!field.required) continue;
        if (field.dependsOn != null) {
          final parentVal = s.entityData[field.dependsOn]?.toString();
          if (parentVal != field.dependsValue) {
            continue;
          }
        }
        final val = s.entityData[field.key];
        if (val == null || val.toString().trim().isEmpty) {
          return false;
        }
      }
      return true;

    case kStepLocation:
      if (s.selectedRegion == null || s.selectedDepartment == null) {
        return false;
      }
      if (s.selectedSubdivision != null) return true;
      if (s.subdivisions.isEmpty && !s.loadingSubdivisions) return true;
      return false;

    case kStepSecurity:
      return s.isSecurityValid;

    case kStepReview:
      return true;

    default:
      return false;
  }
}
