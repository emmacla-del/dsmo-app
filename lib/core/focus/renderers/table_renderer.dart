// lib/core/focus/renderers/table_renderer.dart

import 'package:flutter/material.dart';
import '../schema/field_schema.dart';
import '../unified_focus_manager_v2.dart';
import 'generic_spreadsheet_table.dart';
import 'table_spec_builder.dart';
import 'onefop_layout_constants.dart';

class TableRenderer {
  TableRenderer._();

  static Widget renderTable({
    required FieldSchema field,
    required Map<String, int> gridValues,
    required void Function(String, int) onCellChanged,
    required UnifiedFocusManagerV2 focusManager,
    required String entityType,
    VoidCallback? onExitTable,
    VoidCallback? onExitPrevious,
    // ← ADD: hybrid controller for text/label cells (reasons, skills, training)
    TextEditingController Function(String)? hybridController,
  }) {
    final spec = field.tableSpec;
    if (spec == null) {
      return const SizedBox.shrink();
    }

    final template = (spec['template'] as String? ?? '').trim();
    final prefix = ((spec['prefix'] as String?) ?? field.id).toLowerCase();

    final renderSpec = TableSpecBuilder.build(
      template: template,
      prefix: prefix,
      gridValues: gridValues,
      onCellChanged: onCellChanged,
      entityType: entityType,
    );

    // ← BUILD textValues from hybrid controllers for row label cells
    final Map<String, String> textValues = {};
    if (hybridController != null && renderSpec.rowLabelCellIds != null) {
      for (final cellId in renderSpec.rowLabelCellIds!) {
        if (cellId.isNotEmpty) {
          final c = hybridController(cellId);
          textValues[cellId] = c.text;
        }
      }
    }

    final table = GenericSpreadsheetTable(
      spec: renderSpec,
      numberValues: gridValues,
      textValues: textValues, // ← NOW POPULATED
      onNumberChanged: onCellChanged,
      onTextChanged: (id, value) {
        // ← NOW FUNCTIONAL
        if (hybridController != null) {
          final c = hybridController(id);
          // Only update if different to avoid cursor jumps
          if (c.text != value) {
            c.text = value;
          }
        }
      },
      focusManager: focusManager,
      tableId: prefix,
      onExitTable: onExitTable,
      onExitPrevious: onExitPrevious,
      hybridController: hybridController, // ← PASS THROUGH
    );

    final paperCode = field.paperCode;
    final questionText = field.questionText;
    final hasHeader = (paperCode != null && paperCode.isNotEmpty) ||
        (questionText != null && questionText.isNotEmpty);

    if (!hasHeader) {
      return Padding(
        padding: const EdgeInsets.only(bottom: OL.questionGapV),
        child: table,
      );
    }

    // FIX: paperCode and questionText rendered inline on the same line
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: OL.labelGapV),
          padding: const EdgeInsets.symmetric(
            horizontal: OL.sectionBodyPaddingH,
            vertical: 8,
          ),
          decoration: OL.qtDecoration,
          child: RichText(
            text: TextSpan(
              style: OL.qtStyle,
              children: [
                if (paperCode != null && paperCode.isNotEmpty)
                  TextSpan(
                    text: '$paperCode ',
                    style: OL.qcStyle,
                  ),
                if (questionText != null && questionText.isNotEmpty)
                  TextSpan(text: questionText),
              ],
            ),
          ),
        ),
        table,
      ],
    );
  }
}
