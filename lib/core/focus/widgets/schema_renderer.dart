// lib/core/focus/widgets/schema_renderer.dart

import 'dart:async';
import 'package:flutter/material.dart';
import '../schema/section_schema.dart';
import '../schema/field_schema.dart';
import '../unified_focus_manager_v2.dart';
import '../utils/table_calculator.dart';
import '../renderers/table_renderer.dart';
import 'package:dsmo_app/core/focus/renderers/shared/text_field.dart';
import 'package:dsmo_app/core/focus/renderers/shared/number_field.dart';

enum FormMode { draft, final_ }

class SchemaRenderer extends StatefulWidget {
  final SectionSchema section;
  final UnifiedFocusManagerV2 focusManager;
  final VoidCallback onChanged;
  final String entityType;
  final Future<void> Function(Map<String, int> data, FormMode mode)? onSave;

  const SchemaRenderer({
    super.key,
    required this.section,
    required this.focusManager,
    required this.onChanged,
    required this.entityType,
    this.onSave,
  });

  @override
  State<SchemaRenderer> createState() => _SchemaRendererState();
}

class _SchemaRendererState extends State<SchemaRenderer> {
  final Map<String, int> _userValues = {};
  final Map<String, String> _textValues = {};
  Map<String, int> _allValues = {};

  Timer? _debounceTimer;
  Timer? _autoSaveTimer;

  final Set<String> _dirtyTables = {};
  final Map<String, String?> _radioValues = {};

  bool _hasUnsavedChanges = false;
  bool _isDraftMode = true;
  DateTime _lastSaveTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    debugPrint('🔵🔵🔵 SCHEMA RENDERER initState STARTED 🔵🔵🔵');
    debugPrint('   section.fieldIds: ${widget.section.fieldIds}');
    debugPrint('   section.fieldIds count: ${widget.section.fieldIds.length}');
    _initializeAllCellValues();
    debugPrint('🔵🔵🔵 SCHEMA RENDERER initState COMPLETED 🔵🔵🔵');
    debugPrint('   _userValues count: ${_userValues.length}');
    debugPrint('   _allValues count: ${_allValues.length}');
    if (_userValues.isNotEmpty) {
      debugPrint(
          '   Sample _userValues keys: ${_userValues.keys.take(5).toList()}');
    }
    _startAutoSave();
  }

  // ─────────────────────────────────────────────────────────────
  // AUTO-SAVE
  // ─────────────────────────────────────────────────────────────

  void _startAutoSave() {
    _autoSaveTimer?.cancel();
    _autoSaveTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _saveDraft(),
    );
    debugPrint('⏰ Auto-save timer started (every 30 seconds)');
  }

  Future<void> _saveDraft() async {
    if (!_hasUnsavedChanges || widget.onSave == null) return;

    final now = DateTime.now();
    if (now.difference(_lastSaveTime).inSeconds < 5) return;

    debugPrint('💾 Auto-saving draft... (${_userValues.length} values)');

    try {
      await widget.onSave!(_userValues, FormMode.draft);
      _hasUnsavedChanges = false;
      _lastSaveTime = now;

      if (mounted) {
        ScaffoldMessenger.of(context).clearSnackBars();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Draft saved'),
            duration: const Duration(seconds: 1),
            backgroundColor: Colors.green.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      debugPrint('✅ Draft auto-saved successfully');
    } catch (e) {
      debugPrint('❌ Auto-save failed: $e');
    }
  }

  Future<void> _manualSaveDraft() async {
    if (widget.onSave == null) return;

    debugPrint('💾 Manual draft save...');
    try {
      await widget.onSave!(_userValues, FormMode.draft);
      _hasUnsavedChanges = false;
      _lastSaveTime = DateTime.now();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Draft saved successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save draft: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _submitFinal() async {
    if (widget.onSave == null) return;

    final errors = _validateAllFields();
    if (errors.isNotEmpty) {
      _showValidationErrors(errors);
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit Form'),
        content: const Text(
          'Are you sure you want to submit this form?\n\n'
          'Once submitted, you cannot make changes.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await widget.onSave!(_allValues, FormMode.final_);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Form submitted successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        setState(() => _isDraftMode = false);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Submission failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  List<String> _validateAllFields() {
    final errors = <String>[];

    for (final fieldId in widget.section.fieldIds) {
      final field = widget.focusManager.engine.schema.getField(fieldId);
      if (field == null) continue;

      if (field.type == 'table' && field.tableSpec != null) {
        final cellIds = _generateAllCellIds(field);
        bool hasMissing = false;

        for (final cellId in cellIds) {
          final value = _userValues[cellId];
          if (value == null || value == 0) {
            hasMissing = true;
            break;
          }
        }

        if (hasMissing) {
          errors.add('${field.label ?? field.id}: Please fill all cells');
        }
      }
    }

    return errors;
  }

  void _showValidationErrors(List<String> errors) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Validation Errors'),
        content: SizedBox(
          width: 300,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Please fix the following issues:'),
              const SizedBox(height: 8),
              ...errors.map((e) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      children: [
                        const Icon(Icons.error, color: Colors.red, size: 16),
                        const SizedBox(width: 8),
                        Expanded(child: Text(e)),
                      ],
                    ),
                  )),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────

  void _initializeAllCellValues() {
    debugPrint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugPrint('🏁🏁🏁 _initializeAllCellValues() STARTED 🏁🏁🏁');

    for (final fieldId in widget.section.fieldIds) {
      final field = widget.focusManager.engine.schema.getField(fieldId);
      debugPrint('   📋 Processing fieldId: $fieldId');
      debugPrint('      field found: ${field != null}');

      if (field == null) continue;

      debugPrint('      field.type: ${field.type}');
      debugPrint('      field.tableSpec: ${field.tableSpec != null}');

      if (field.type == 'table' && field.tableSpec != null) {
        final template = field.tableSpec!['template'] as String?;
        final prefix = field.tableSpec!['prefix'] as String? ?? field.id;
        debugPrint('      template: $template');
        debugPrint('      raw prefix: $prefix');
        debugPrint('      lowercase prefix: ${prefix.toLowerCase()}');

        final cellIds = _generateAllCellIds(field);
        debugPrint('      ✅ Generated ${cellIds.length} cell IDs');
        if (cellIds.isNotEmpty) {
          debugPrint('      First 5 cell IDs: ${cellIds.take(5).toList()}');
        }

        for (final cellId in cellIds) {
          if (!_userValues.containsKey(cellId)) {
            _userValues[cellId] = 0;
          }
        }
        debugPrint(
            '      📊 _userValues now has ${_userValues.length} entries');
      } else {
        debugPrint('      ⚠️ Not a table or no tableSpec - skipping');
      }
    }

    _allValues = Map.from(_userValues);

    for (final fieldId in widget.section.fieldIds) {
      final field = widget.focusManager.engine.schema.getField(fieldId);
      if (field == null) continue;
      if (field.type == 'table' && field.tableSpec != null) {
        final prefix =
            (field.tableSpec!['prefix'] as String? ?? field.id).toLowerCase();
        _dirtyTables.add(prefix);
      }
    }
    if (_dirtyTables.isNotEmpty) {
      _recalculateDirtyTables();
    }

    debugPrint('🏁🏁🏁 _initializeAllCellValues() COMPLETED 🏁🏁🏁');
    debugPrint('   ✅ Initialized ${_allValues.length} total cells');
    debugPrint('   📊 _userValues count: ${_userValues.length}');
    debugPrint('   📊 _allValues count: ${_allValues.length}');
    debugPrint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  // ─────────────────────────────────────────────────────────────
  // CELL ID GENERATORS
  // ─────────────────────────────────────────────────────────────

  List<String> _generateAllCellIds(FieldSchema field) {
    final spec = field.tableSpec!;
    final template = spec['template'] as String?;
    final rawPrefix = spec['prefix'] as String? ?? field.id;
    final prefix = rawPrefix.toLowerCase();

    debugPrint('      🔧 _generateAllCellIds for template: $template');
    debugPrint('         rawPrefix: $rawPrefix → lowercase: $prefix');

    switch (template) {
      case 'csp_gender_age_table':
      case 'csp_table':
        return _generateCspGenderAgeCellIds(prefix);

      case 'diploma_gender_age_table':
      case 'diploma_table':
        return _generateDiplomaCellIds(prefix);

      case 'csp_status_gender_table':
      case 'disability_table':
      case 'vulnerable_table':
        return _generateCspStatusGenderCellIds(prefix);

      case 'departure_table':
        return _generateDepartureCellIds(prefix);

      case 'dismissal_unemployment_table':
        return _generateDismissalUnemploymentCellIds(prefix);

      case 'first_time_workers_table':
        return _generateFirstTimeWorkersCellIds(prefix);

      case 'internship_table':
        return _generateInternshipCellIds(prefix);

      case 'reasons_table':
        return _generateReasonsCellIds(prefix);

      case 'skills_table':
        return _generateSkillsCellIds(prefix);

      case 'training_table':
        return _generateTrainingCellIds(prefix);

      default:
        debugPrint(
            '         ⚠️ WARNING: Unknown template: "$template" for field ${field.id}');
        return [];
    }
  }

  List<String> _generateCspGenderAgeCellIds(String prefix) {
    const rows = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female'];
    const ageBands = ['15_24', '25_34', '35_plus'];
    final cellIds = <String>[];
    for (final row in rows) {
      for (final gender in genders) {
        for (final age in ageBands) {
          cellIds.add('${prefix}_${row}_${gender}_$age');
        }
      }
    }
    return cellIds;
  }

  List<String> _generateDiplomaCellIds(String prefix) {
    const diplomas = [
      'cep',
      'probatoire',
      'bac',
      'bts',
      'licence',
      'maitrise',
      'master',
      'dqp',
      'cqp',
      'autres',
      'sans_diplome',
    ];
    const genders = ['male', 'female'];
    const ageBands = ['15_24', '25_34', '35_plus'];
    final cellIds = <String>[];
    for (final diploma in diplomas) {
      for (final gender in genders) {
        for (final age in ageBands) {
          cellIds.add('${prefix}_${diploma}_${gender}_$age');
        }
      }
    }
    return cellIds;
  }

  List<String> _generateCspStatusGenderCellIds(String prefix) {
    const rows = ['cadres', 'foremen', 'workers'];
    const statuses = ['permanent', 'temporary'];
    const genders = ['male', 'female'];
    final cellIds = <String>[];
    for (final row in rows) {
      for (final status in statuses) {
        for (final gender in genders) {
          cellIds.add('${prefix}_${row}_${status}_$gender');
        }
      }
    }
    return cellIds;
  }

  List<String> _generateDepartureCellIds(String prefix) {
    const rows = ['cadres', 'foremen', 'workers'];
    const types = ['dismissal', 'resignation', 'retirement', 'other'];
    const genders = ['male', 'female'];
    final cellIds = <String>[];
    for (final row in rows) {
      for (final type in types) {
        for (final gender in genders) {
          cellIds.add('${prefix}_${row}_${type}_$gender');
        }
      }
    }
    return cellIds;
  }

  List<String> _generateDismissalUnemploymentCellIds(String prefix) {
    const rows = ['cadres', 'foremen', 'workers'];
    const types = ['dismissal', 'technical_unemployment'];
    const genders = ['male', 'female'];
    final cellIds = <String>[];
    for (final row in rows) {
      for (final type in types) {
        for (final gender in genders) {
          cellIds.add('${prefix}_${row}_${type}_$gender');
        }
      }
    }
    return cellIds;
  }

  List<String> _generateFirstTimeWorkersCellIds(String prefix) {
    const contractTypes = ['permanent', 'temporary'];
    const rows = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female'];
    const ageBands = ['15_24', '25_34', '35_plus'];
    final cellIds = <String>[];
    for (final contract in contractTypes) {
      for (final row in rows) {
        for (final gender in genders) {
          for (final age in ageBands) {
            cellIds.add('${prefix}_${contract}_${row}_${gender}_$age');
          }
        }
      }
    }
    return cellIds;
  }

  List<String> _generateInternshipCellIds(String prefix) {
    const rows = ['vacation', 'academic', 'professional', 'pre_employment'];
    const genders = ['male', 'female'];
    final cellIds = <String>[];
    for (final row in rows) {
      for (final gender in genders) {
        cellIds.add('${prefix}_${row}_$gender');
      }
    }
    return cellIds;
  }

  List<String> _generateReasonsCellIds(String prefix) {
    const reasons = ['reason_1', 'reason_2', 'reason_3'];
    const genders = ['male', 'female'];
    final cellIds = <String>[];
    for (final reason in reasons) {
      for (final gender in genders) {
        cellIds.add('${prefix}_${reason}_$gender');
      }
    }
    return cellIds;
  }

  List<String> _generateSkillsCellIds(String prefix) {
    const rows = ['skill_1', 'skill_2', 'skill_3'];
    const genders = ['male', 'female'];
    final cellIds = <String>[];
    for (final row in rows) {
      for (final gender in genders) {
        cellIds.add('${prefix}_${row}_$gender');
      }
    }
    return cellIds;
  }

  List<String> _generateTrainingCellIds(String prefix) {
    const rows = ['domain_1', 'domain_2', 'domain_3'];
    const genders = ['male', 'female'];
    final cellIds = <String>[];
    for (final row in rows) {
      for (final gender in genders) {
        cellIds.add('${prefix}_${row}_$gender');
      }
    }
    return cellIds;
  }

  // ─────────────────────────────────────────────────────────────
  // PREFIX EXTRACTION
  // ─────────────────────────────────────────────────────────────

  String _extractTablePrefix(String cellId) {
    final parts = cellId.split('_');
    for (final part in parts) {
      if (RegExp(r'^s\d+q\d+$').hasMatch(part)) return part;
    }
    return parts.first;
  }

  // ─────────────────────────────────────────────────────────────
  // CELL CHANGE HANDLER
  // ─────────────────────────────────────────────────────────────

  void _handleCellChange(String cellId, int newValue) {
    debugPrint('🔵 CELL CHANGE: $cellId = $newValue');

    if (newValue != 0) {
      _userValues[cellId] = newValue;
    } else {
      _userValues.remove(cellId);
    }

    _hasUnsavedChanges = true;

    setState(() {
      _allValues[cellId] = newValue;
    });

    final prefix = _extractTablePrefix(cellId);
    _dirtyTables.add(prefix);
    debugPrint('📌 Marked dirty: $prefix, dirty tables: $_dirtyTables');

    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      debugPrint('⏰ TIMER FIRED - Recalculating totals');
      _recalculateDirtyTables();
      widget.onChanged();

      Timer(const Duration(milliseconds: 2000), () {
        _saveDraft();
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // RECALCULATION DISPATCH
  // ─────────────────────────────────────────────────────────────

  void _recalculateDirtyTables() {
    debugPrint('🔥🔥🔥 _recalculateDirtyTables CALLED 🔥🔥🔥');

    if (_dirtyTables.isEmpty) {
      debugPrint('⚠️ No dirty tables, skipping recalculation');
      return;
    }

    debugPrint('🔄 Recalculating tables: $_dirtyTables');

    Map<String, int> workingValues = Map.from(_allValues);
    final prefixesToProcess = Set<String>.from(_dirtyTables);

    for (final prefix in prefixesToProcess) {
      debugPrint('   Processing prefix: $prefix');
      final before = workingValues.length;
      workingValues = _dispatchRecalculation(workingValues, prefix);
      debugPrint('   Added ${workingValues.length - before} new keys (totals)');
    }

    setState(() {
      _allValues = workingValues;
      _dirtyTables.clear();
    });

    final totalKeys =
        _allValues.keys.where((k) => k.contains('total')).toList();
    if (totalKeys.isNotEmpty) {
      debugPrint('✅ SUCCESS: ${totalKeys.length} total cells present');
      debugPrint('   Sample totals: ${totalKeys.take(3).toList()}');
    } else {
      debugPrint('❌ FAILURE: No total cells found after recalculation');
    }
  }

  Map<String, int> _dispatchRecalculation(
      Map<String, int> current, String prefix) {
    switch (prefix) {
      case 's21q01':
      case 's22q01':
      case 's22q02':
      case 's23q01':
        return TableCalculator.recalculateCspGenderAge(
          current: current,
          prefix: prefix,
          rows: ['cadres', 'foremen', 'workers'],
          genders: ['male', 'female', 'total'],
          ageBands: ['15_24', '25_34', '35_plus'],
        );

      case 's22q03':
        return TableCalculator.recalculateCspGenderAge(
          current: current,
          prefix: prefix,
          rows: [
            'cep',
            'probatoire',
            'bac',
            'bts',
            'licence',
            'maitrise',
            'master',
            'dqp',
            'cqp',
            'autres',
            'sans_diplome',
          ],
          genders: ['male', 'female', 'total'],
          ageBands: ['15_24', '25_34', '35_plus'],
        );

      case 's22q04':
        return TableCalculator.recalculateCspStatusGender(
          current: current,
          prefix: prefix,
          rows: ['cadres', 'foremen', 'workers'],
          statuses: ['permanent', 'temporary'],
          genders: ['male', 'female', 'total'],
        );

      case 's22q05':
        return TableCalculator.recalculateCspStatusGender(
          current: current,
          prefix: prefix,
          rows: widget.entityType == 'enterprise'
              ? ['deplaces_internes', 'refugies', 'orphelins']
              : ['cadres', 'foremen', 'workers'],
          statuses: ['permanent', 'temporary'],
          genders: ['male', 'female', 'total'],
        );

      case 's3q01':
        return TableCalculator.recalculateDeparture(
          current: current,
          prefix: prefix,
          rows: ['cadres', 'foremen', 'workers'],
          departureTypes: [
            'dismissal',
            'resignation',
            'retirement',
            'other',
            'ensemble',
          ],
          genders: ['male', 'female', 'total'],
        );

      case 's3q02':
        return TableCalculator.recalculateReasons(
          current: current,
          prefix: prefix,
          reasons: ['reason_1', 'reason_2', 'reason_3'],
          genders: ['male', 'female', 'total'],
        );

      case 's3q03':
        return TableCalculator.recalculateDismissalUnemployment(
          current: current,
          prefix: prefix,
          rows: ['cadres', 'foremen', 'workers'],
          types: ['dismissal', 'technical_unemployment', 'total'],
          genders: ['male', 'female', 'total'],
        );

      case 's23q02':
        return TableCalculator.recalculateFirstTimeWorkers(
          current: current,
          prefix: prefix,
          contractTypes: ['permanent', 'temporary'],
          rows: ['cadres', 'foremen', 'workers'],
          genders: ['male', 'female', 'total'],
          ageBands: ['15_24', '25_34', '35_plus'],
        );

      case 's4q01':
        return TableCalculator.recalculateInternship(
          current: current,
          prefix: prefix,
          rows: ['vacation', 'academic', 'professional', 'pre_employment'],
          genders: ['male', 'female', 'total'],
        );

      case 's4q02':
        return TableCalculator.recalculateSkills(
          current: current,
          prefix: prefix,
          genders: ['male', 'female', 'total'],
        );

      case 's4q03':
        return TableCalculator.recalculateTraining(
          current: current,
          prefix: prefix,
          genders: ['male', 'female', 'total'],
        );

      default:
        debugPrint('⚠️ Unknown prefix in _dispatchRecalculation: $prefix');
        return current;
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _autoSaveTimer?.cancel();

    if (_hasUnsavedChanges && widget.onSave != null) {
      widget.onSave!(_userValues, FormMode.draft);
    }

    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_isDraftMode && widget.onSave != null)
          Container(
            color: Colors.orange.shade100,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: Colors.orange,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.save, size: 16, color: Colors.white),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Draft Mode',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      Text(
                        _hasUnsavedChanges
                            ? 'Unsaved changes • Auto-saving in progress'
                            : 'All changes saved',
                        style: const TextStyle(fontSize: 11),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: _manualSaveDraft,
                  icon: const Icon(Icons.save, size: 18),
                  label: const Text('Save Now'),
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.orange.shade800,
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _submitFinal,
                  icon: const Icon(Icons.check_circle, size: 18),
                  label: const Text('Submit Final'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: widget.section.fieldIds.map((fieldId) {
              final field = widget.focusManager.engine.schema.getField(fieldId);
              if (field == null) return const SizedBox.shrink();

              if (field.type == 'table') {
                return TableRenderer.renderTable(
                  field: field,
                  gridValues: _allValues,
                  onCellChanged: _handleCellChange,
                  focusManager: widget.focusManager,
                  entityType: widget.entityType,
                );
              } else {
                return _renderSimpleField(field);
              }
            }).toList(),
          ),
        ),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SIMPLE FIELD RENDERERS
  // ─────────────────────────────────────────────────────────────

  Widget _renderSimpleField(FieldSchema field) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (field.paperCode != null)
              Text(
                field.paperCode!,
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.blue,
                  fontWeight: FontWeight.bold,
                ),
              ),
            const SizedBox(height: 4),
            Text(field.label ?? field.id, style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            _buildInputForField(field),
          ],
        ),
      ),
    );
  }

  Widget _buildInputForField(FieldSchema field) {
    switch (field.type) {
      // ── text ──────────────────────────────────────────────────
      case 'text':
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: FormTextField(
            fieldId: field.id,
            value: _textValues[field.id] ?? '',
            // After
            onChanged: (value) {
              setState(() => _textValues[field.id] = value);
              widget.onChanged();
              _hasUnsavedChanges = true;
            },
            focusManager: widget.focusManager,
            tableId: field.id,
            width: 300,
            height: 38,
            hintText: field.hint,
            // Single-cell list: indexOf always returns 0, so arrow/tab
            // navigation is a no-op (exits immediately via onExitTable /
            // onExitPrevious, both null here). rowWidth=1 keeps the
            // row/col math consistent with a 1-column "grid".
            allCells: [field.id],
            rowWidth: 1,
          ),
        );

      // ── number ────────────────────────────────────────────────
      case 'number':
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: NumberField(
            fieldId: field.id,
            value: _userValues[field.id] ?? 0,
            onChanged: (fid, value) {
              setState(() {
                if (value != 0) {
                  _userValues[fid] = value;
                } else {
                  _userValues.remove(fid);
                }
                _allValues[fid] = value;
              });
              widget.onChanged();
              _hasUnsavedChanges = true;
            },
            focusManager: widget.focusManager,
            tableId: field.id,
            width: 120,
            height: 38,
            // Same reasoning as TextFieldCell above.
            allCells: [field.id],
            rowWidth: 1,
          ),
        );

      // ── radio ─────────────────────────────────────────────────
      case 'radio':
        // StatefulBuilder removed: the parent _SchemaRendererState already
        // calls setState, so local rebuilds were redundant and could mask
        // stale state bugs. _radioValues lives in the parent state map and
        // is updated via setState in onChanged, which triggers a full rebuild.
        //
        // RadioListTile groupValue/onChanged are kept here because RadioGroup
        // is only available from Flutter ≥ 3.32. If you are on 3.32+, wrap
        // the Column in a RadioGroup<String> and move groupValue/onChanged
        // there, removing them from each RadioListTile.
        final groupKey = field.id;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: field.options
                  ?.map(
                    (opt) => RadioListTile<String>(
                      title: Text(opt),
                      value: opt,
                      // ignore: deprecated_member_use
                      groupValue: _radioValues[groupKey],
                      // ignore: deprecated_member_use
                      onChanged: (val) {
                        setState(() => _radioValues[groupKey] = val);
                        widget.onChanged();
                        _hasUnsavedChanges = true;
                      },
                    ),
                  )
                  .toList() ??
              [],
        );

      // ── fallback ──────────────────────────────────────────────
      default:
        return Text('Unsupported field type: ${field.type}');
    }
  }
}
