// test/register_unit_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:dsmo_app/data/minefop_models.dart';
import 'package:dsmo_app/screens/register_constants.dart';
import 'package:dsmo_app/screens/register_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('isSectionComplete', () {
    test('EntityType step completeness', () {
      const emptyState = RegState();
      expect(isSectionComplete(kStepEntityType, emptyState), isFalse);

      final selectedState = emptyState.copyWith(entityType: EntityType.enterprise);
      expect(isSectionComplete(kStepEntityType, selectedState), isTrue);
    });

    test('Respondent step completeness', () {
      var state = const RegState();
      expect(isSectionComplete(kStepRespondent, state), isFalse);

      state = state.copyWith(
        respondentFirstName: 'Jean',
        respondentLastName: 'Dupont',
        respondentFunction: 'Directeur Général',
        respondentEmail: 'jean@example.cm',
        respondentPhone1: '690000000',
        emailIsAvailable: true,
      );
      // Valid without phone 2
      expect(isSectionComplete(kStepRespondent, state), isTrue);

      // Incomplete if email is not available
      expect(
        isSectionComplete(
            kStepRespondent, state.copyWith(emailIsAvailable: false)),
        isFalse,
      );

      // Incomplete if any required field is empty
      expect(
        isSectionComplete(
            kStepRespondent, state.copyWith(respondentFirstName: '  ')),
        isFalse,
      );
      expect(
        isSectionComplete(
            kStepRespondent, state.copyWith(respondentLastName: '')),
        isFalse,
      );
      expect(
        isSectionComplete(
            kStepRespondent, state.copyWith(respondentFunction: '')),
        isFalse,
      );
      expect(
        isSectionComplete(
            kStepRespondent, state.copyWith(respondentEmail: '')),
        isFalse,
      );
      expect(
        isSectionComplete(
            kStepRespondent, state.copyWith(respondentPhone1: '')),
        isFalse,
      );

      // Phone 2 can be empty or non-empty without affecting completeness
      expect(
        isSectionComplete(
            kStepRespondent, state.copyWith(respondentPhone2: '670000000')),
        isTrue,
      );
    });

    test('EntityInfo step completeness including dependsOn fields', () {
      // Enterprise required fields: companyName, legalStatus, taxNumber, mainActivity, address, phone
      var entState = const RegState(
        entityType: EntityType.enterprise,
        entityData: {
          'companyName': 'ABC SARL',
          'legalStatus': 'SARL',
          'taxNumber': 'M012345678',
          'mainActivity': 'Commerce',
          'address': 'Douala',
          'phone': '690112233',
        },
      );
      expect(isSectionComplete(kStepEntityInfo, entState), isTrue);

      // Missing phone
      expect(
        isSectionComplete(
          kStepEntityInfo,
          entState.copyWith(
            entityData: Map.from(entState.entityData)..remove('phone'),
          ),
        ),
        isFalse,
      );

      // Vocational Training dependsOn check:
      // functionalStatus -> nonFunctionalReason (only required if Non-fonctionnelle)
      var vtState = const RegState(
        entityType: EntityType.vocationalTraining,
        entityData: {
          'centerName': 'CFP Centre',
          'taxNumber': 'M999999',
          'cfpType': 'Centre de Formation Professionnelle Rapide (CFPR)',
          'educationSystem': 'Public',
          'functionalStatus': 'Fonctionnelle',
          'yearOfCreation': '2010',
          'address': 'Yaounde',
          'phone': '699000000',
          'promoterName': 'Paul Biya',
          'promoterSex': 'Masculin',
          'promoterPhone1': '699111222',
        },
      );
      // When 'Fonctionnelle', nonFunctionalReason is not visible, so not required
      expect(isSectionComplete(kStepEntityInfo, vtState), isTrue);

      // When 'Non-fonctionnelle', nonFunctionalReason is visible and required!
      final vtNonFuncIncomplete = vtState.copyWith(
        entityData: Map.from(vtState.entityData)
          ..['functionalStatus'] = 'Non-fonctionnelle',
      );
      expect(isSectionComplete(kStepEntityInfo, vtNonFuncIncomplete), isFalse);

      // With nonFunctionalReason provided, it is complete
      final vtNonFuncComplete = vtState.copyWith(
        entityData: Map.from(vtState.entityData)
          ..['functionalStatus'] = 'Non-fonctionnelle'
          ..['nonFunctionalReason'] = "Manque d'apprenants",
      );
      expect(isSectionComplete(kStepEntityInfo, vtNonFuncComplete), isTrue);

      // If nonFunctionalReason == 'Autres', nonFunctionalReasonOther is required!
      final vtNonFuncOtherIncomplete = vtState.copyWith(
        entityData: Map.from(vtState.entityData)
          ..['functionalStatus'] = 'Non-fonctionnelle'
          ..['nonFunctionalReason'] = 'Autres',
      );
      expect(isSectionComplete(kStepEntityInfo, vtNonFuncOtherIncomplete), isFalse);

      final vtNonFuncOtherComplete = vtState.copyWith(
        entityData: Map.from(vtState.entityData)
          ..['functionalStatus'] = 'Non-fonctionnelle'
          ..['nonFunctionalReason'] = 'Autres'
          ..['nonFunctionalReasonOther'] = 'Restructuration en cours',
      );
      expect(isSectionComplete(kStepEntityInfo, vtNonFuncOtherComplete), isTrue);
    });

    test('Location step completeness and empty-subdivision case', () {
      var locState = const RegState();
      expect(isSectionComplete(kStepLocation, locState), isFalse);

      locState = locState.copyWith(
        selectedRegion: {'id': '1', 'name': 'Centre'},
        selectedDepartment: {'id': '10', 'name': 'Mfoundi'},
        selectedSubdivision: {'id': '101', 'name': 'Yaoundé 1'},
      );
      expect(isSectionComplete(kStepLocation, locState), isTrue);

      // Empty-subdivision case: department has no subdivisions returned and is not loading
      final emptySubdivState = locState.copyWith(
        clearSubdivision: true,
        subdivisions: [],
        loadingSubdivisions: false,
      );
      expect(isSectionComplete(kStepLocation, emptySubdivState), isTrue);

      // While loading subdivisions, not yet complete
      final loadingSubdivState = emptySubdivState.copyWith(
        loadingSubdivisions: true,
      );
      expect(isSectionComplete(kStepLocation, loadingSubdivState), isFalse);
    });

    test('Security step completeness', () {
      var secState = const RegState(isSecurityValid: false);
      expect(isSectionComplete(kStepSecurity, secState), isFalse);

      secState = secState.copyWith(isSecurityValid: true);
      expect(isSectionComplete(kStepSecurity, secState), isTrue);
    });
  });
}
