import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/onefop_form_loader.dart';
import 'package:dsmo_app/data/minefop_models.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart'
    show entityTypeForSchema;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ONEFOP Territory ReadOnly Tests (Parity with React)', () {
    test('Enterprise S1Q04 territory fields are readOnly', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.enterprise));
      final regionField = schema.getField('S1Q04_REGION');
      final deptField = schema.getField('S1Q04_DEPT');
      final subdivField = schema.getField('S1Q04_SUBDIV');
      final localityField = schema.getField('S1Q04_LOCALITY');

      expect(regionField, isNotNull);
      expect(regionField!.readOnly, isTrue);

      expect(deptField, isNotNull);
      expect(deptField!.readOnly, isTrue);

      expect(subdivField, isNotNull);
      expect(subdivField!.readOnly, isTrue);

      expect(localityField, isNotNull);
      expect(localityField!.readOnly, isFalse);
    });

    test('Administration S1Q04 territory fields are readOnly', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.administration));
      expect(schema.getField('ADMIN_S1Q04_REGION')?.readOnly, isTrue);
      expect(schema.getField('ADMIN_S1Q04_DEPT')?.readOnly, isTrue);
      expect(schema.getField('ADMIN_S1Q04_SUBDIV')?.readOnly, isTrue);
      expect(schema.getField('ADMIN_S1Q04_LOCALITY')?.readOnly, isFalse);
    });

    test('Cooperative S1Q05 territory fields are readOnly', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.cooperative));
      expect(schema.getField('COOP_S1Q05_REGION')?.readOnly, isTrue);
      expect(schema.getField('COOP_S1Q05_DEPT')?.readOnly, isTrue);
      expect(schema.getField('COOP_S1Q05_SUBDIV')?.readOnly, isTrue);
      expect(schema.getField('COOP_S1Q05_LOCALITY')?.readOnly, isFalse);
    });

    test('CTD S1Q05 territory fields are readOnly', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.ctd));
      expect(schema.getField('CTD_S1Q05_REGION')?.readOnly, isTrue);
      expect(schema.getField('CTD_S1Q05_DEPT')?.readOnly, isTrue);
      expect(schema.getField('CTD_S1Q05_SUBDIV')?.readOnly, isTrue);
      expect(schema.getField('CTD_S1Q05_LOCALITY')?.readOnly, isFalse);
    });

    test('ONG S1Q05 territory fields are readOnly', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.ong));
      expect(schema.getField('ONG_S1Q05_REGION')?.readOnly, isTrue);
      expect(schema.getField('ONG_S1Q05_DEPT')?.readOnly, isTrue);
      expect(schema.getField('ONG_S1Q05_SUBDIV')?.readOnly, isTrue);
      expect(schema.getField('ONG_S1Q05_LOCALITY')?.readOnly, isFalse);
    });

    test('ProjectProgram S1Q06 territory fields are readOnly', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.projectProgram));
      expect(schema.getField('PP_S1Q06_REGION')?.readOnly, isTrue);
      expect(schema.getField('PP_S1Q06_DEPT')?.readOnly, isTrue);
      expect(schema.getField('PP_S1Q06_SUBDIV')?.readOnly, isTrue);
      expect(schema.getField('PP_S1Q06_LOCALITY')?.readOnly, isFalse);
    });

    test('VocationalTraining VT1_4..6 territory fields are readOnly', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.vocationalTraining));
      expect(schema.getField('VT1_4')?.readOnly, isTrue);
      expect(schema.getField('VT1_5')?.readOnly, isTrue);
      expect(schema.getField('VT1_6')?.readOnly, isTrue);
    });
  });
}
