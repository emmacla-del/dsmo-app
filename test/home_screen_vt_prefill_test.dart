// Regression coverage for the VT-ONBOARDING prefill pipeline fix
// (2026-08-31): three stacked bugs meant a registered VOCATIONAL_TRAINING
// company could never open, let alone see prefilled, its ONEFOP
// questionnaire, despite the mapping *logic* looking correct on paper.
//
// Unlike test/vt_registration_screenshot_test.dart (a "throwaway visual
// audit tool" that hand-writes an initialData map bypassing both
// parseCompanyEntityType and companyToInitialData entirely), these tests
// call the real, production functions directly. That's only possible
// because both were promoted from private _HomeScreenState instance
// methods to top-level functions in home_screen.dart — Dart's
// leading-underscore privacy is library-scoped, so a private method
// genuinely cannot be invoked from a separate test file. Both functions
// are pure (no BuildContext/widget state), so the promotion is a
// behavior-preserving visibility change, not a logic change.
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/data/minefop_models.dart';
import 'package:dsmo_app/models/user.dart';
import 'package:dsmo_app/screens/home_screen.dart';

// These are plain-Dart-logic tests (no testWidgets/pumpWidget), but
// test/flutter_test_config.dart applies to every file in this directory and
// its setUpAll needs the TestWidgetsFlutterBinding to already exist.

User _testUser({String email = 'director@cfp-test.cm'}) => User(
      id: 'user-1',
      email: email,
      role: 'COMPANY',
      isActive: true,
      features: UserFeatures(),
    );

/// Shaped exactly like DsmoService.getMyCompany()'s Prisma `select` after
/// the src/dsmo/dsmo.service.ts fix — i.e. what GET /dsmo/company actually
/// returns for a VOCATIONAL_TRAINING company today, not a hand-picked
/// fixture. This is what Test B/C/D deliberately test against.
Map<String, dynamic> _apiShapedVtCompany() => {
      'id': 'company-1',
      'name': 'Centre de Formation Rapide de Yaoundé',
      'taxNumber': '9999999999',
      'cnpsNumber': null,
      'registrationNumber': null,
      'establishmentId': 'VT-2026-0000001',
      'establishmentIdGeneratedAt': '2026-08-31T00:00:00.000Z',
      'entityType': 'VOCATIONAL_TRAINING',
      'region': 'Centre',
      'department': 'Mfoundi',
      'subdivision': 'Yaoundé 1',
      'address': 'Quartier Bastos',
      'phone': '699000001',
      'phone2': '677000002',
      'poBox': '1234',
      'mainActivity': null,
      'secondaryActivity': null,
      'parentCompany': null,
      'legalStatus': null,
      'enterpriseSize': null,
      'area': 'Urbain/ Urban',
      'branch': null,
      'respondentFirstName': 'Jean',
      'respondentLastName': 'Dupont',
      'respondentFunction': 'Directeur',
      'respondentPhone': '677123456',
      'respondentPhone2': '699654321',
      'totalEmployees': 0,
      'menCount': null,
      'womenCount': null,
      'yearOfCreation': '2015',
      'sigle': 'CFRY',
      'cfpType': 'Centre de Formation Professionnelle Rapide (CFPR)',
      'educationSystem': 'Public',
      'functionalStatus': 'Fonctionnelle',
      'nonFunctionalReason': null,
      'nonFunctionalReasonOther': null,
      'promoterName': 'Marie Ngo Bell',
      'promoterSex': 'Féminin',
      'promoterPhone1': '699112233',
      'promoterPhone2': '677998877',
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Test A — parseCompanyEntityType', () {
    test('VOCATIONAL_TRAINING resolves to EntityType.vocationalTraining', () {
      expect(parseCompanyEntityType('VOCATIONAL_TRAINING'),
          EntityType.vocationalTraining);
    });

    test('lowercase/mixed-case input still resolves (case-insensitive, '
        'matching the other six cases)', () {
      expect(parseCompanyEntityType('vocational_training'),
          EntityType.vocationalTraining);
    });

    test('the six pre-existing entity types are unaffected by the new case',
        () {
      expect(parseCompanyEntityType('ENTREPRISE'), EntityType.enterprise);
      expect(parseCompanyEntityType('ENTERPRISE'), EntityType.enterprise);
      expect(parseCompanyEntityType('COOPERATIVE'), EntityType.cooperative);
      expect(parseCompanyEntityType('CTD'), EntityType.ctd);
      expect(parseCompanyEntityType('ONG'), EntityType.ong);
      expect(
          parseCompanyEntityType('ADMINISTRATION'), EntityType.administration);
      expect(
          parseCompanyEntityType('PROJECT_PROGRAM'), EntityType.projectProgram);
    });

    test('a genuinely unrecognized value still returns null (the guard in '
        '_openOnefopFormForCompany that shows unknownEntityTypeError must '
        'still fire for real garbage data)', () {
      expect(parseCompanyEntityType('NOT_A_REAL_TYPE'), isNull);
    });
  });

  group('Test B/C — companyToInitialData: institution fields', () {
    final data = companyToInitialData(
        _apiShapedVtCompany(), EntityType.vocationalTraining, _testUser());

    test('name/sigle', () {
      expect(data['VT1_2'], 'Centre de Formation Rapide de Yaoundé');
      expect(data['VT1_3'], 'CFRY');
    });

    test('geography (region/department/subdivision/area) — previously '
        'unmapped for VT despite being captured at registration for every '
        'entity type via the shared Location step', () {
      expect(data['VT1_4'], 'Centre');
      expect(data['VT1_5'], 'Mfoundi');
      expect(data['VT1_6'], 'Yaoundé 1');
      expect(data['VT1_9'], 'Urbain/ Urban');
    });

    test('VT1_8 (Quartier/Village) reuses company[address] — same '
        'approximation every other entity type already makes for its own '
        'LOCALITY field, not a new invented mapping', () {
      expect(data['VT1_8'], 'Quartier Bastos');
    });

    test('education system / CFP type / functional status', () {
      expect(data['VT1_10'], 'Public');
      expect(data['VT1_11'],
          'Centre de Formation Professionnelle Rapide (CFPR)');
      expect(data['VT1_12'], 'Fonctionnelle');
    });

    test('year of establishment', () {
      expect(data['VT1_14'], '2015');
    });

    test('promoter/director block (§1.16)', () {
      expect(data['VT1_16_NAME'], 'Marie Ngo Bell');
      expect(data['VT1_16_SEX'], 'Féminin');
      expect(data['VT1_16_TEL1'], '699112233');
      expect(data['VT1_16_TEL2'], '677998877');
    });

    test('Commune (§1.7) correctly stays unprefilled — no Company column '
        'exists, and no other entity type has an analogous geo field to '
        'borrow from either; genuine schema gap, not invented here', () {
      expect(data.containsKey('VT1_7'), isFalse);
    });
  });

  group('Test D — companyToInitialData: respondent fields (§1.15)', () {
    final data = companyToInitialData(
        _apiShapedVtCompany(), EntityType.vocationalTraining, _testUser());

    test('respondent identification writes to VT1_15_* keys, not the '
        'legacy S0Q* keys the other six entities use', () {
      expect(data['VT1_15_NAME'], 'Jean Dupont');
      expect(data['VT1_15_FUNCTION'], 'Directeur');
      expect(data['VT1_15_TEL1'], '677123456');
      expect(data['VT1_15_TEL2'], '699654321');
      expect(data['VT1_15_EMAIL'], 'director@cfp-test.cm');
    });

    test('the shared S0Q* keys are still also written (pre-existing, '
        'unchanged behavior — the function sets them unconditionally before '
        'the entity-type switch, for all seven entity types), but they are '
        'harmless dead keys for VT specifically since its AST declares no '
        'Section 0 to ever read them back out of initialData', () {
      expect(data['S0Q01'], 'Jean Dupont');
      expect(data['S0Q02'], 'Directeur');
    });

    test('respondent sex (VT1_15_SEX) correctly stays unprefilled — not '
        'captured anywhere at registration or on OnefopRespondent for any '
        'entity type; a business decision, not invented here', () {
      expect(data.containsKey('VT1_15_SEX'), isFalse);
    });
  });

  group('Test E — the specific regression this fixes', () {
    test('a VOCATIONAL_TRAINING company no longer trips the '
        'unknownEntityTypeError guard in _openOnefopFormForCompany '
        '(parseCompanyEntityType must be non-null for it)', () {
      final entityType = (_apiShapedVtCompany()['entityType'] as String);
      expect(parseCompanyEntityType(entityType), isNotNull);
    });
  });

  group('Regression: the six pre-existing entities are unaffected', () {
    test("enterprise's own mapping is untouched by the VT case addition",
        () {
      final data = companyToInitialData(
        {
          'name': 'Acme SARL',
          'legalStatus': 'SARL',
          'region': 'Littoral',
          'department': 'Wouri',
          'subdivision': 'Douala 1',
          'address': 'Akwa',
          'area': 'Urbain/ Urban',
          'phone': '699000000',
          'mainActivity': 'commerce',
        },
        EntityType.enterprise,
        _testUser(),
      );
      expect(data['S1Q02'], 'Acme SARL');
      expect(data['S1Q01'], 'SARL/ LLC');
      expect(data['S1Q04_REGION'], 'Littoral');
      // No VT keys should leak into an enterprise's initial data.
      expect(data.keys.any((k) => k.startsWith('VT1_')), isFalse);
    });
  });
}
