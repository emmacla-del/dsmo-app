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

    final table = GenericSpreadsheetTable(
      spec: renderSpec,
      numberValues: gridValues,
      textValues: const {},
      onNumberChanged: onCellChanged,
      onTextChanged: (_, __) {},
      focusManager: focusManager,
      tableId: prefix,
      onExitTable: onExitTable,
      onExitPrevious: onExitPrevious,
    );

    final paperCode = field.paperCode;
    final questionText = field.questionText;
    final hasHeader = (paperCode != null && paperCode.isNotEmpty) ||
        (questionText != null && questionText.isNotEmpty);

    if (!hasHeader) {
      // Tables without header still need some bottom spacing
      return Padding(
        padding: const EdgeInsets.only(bottom: OL.questionGapV),
        child: table,
      );
    }

    // Tables with header: spacing is handled by the header, so no extra bottom padding
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (paperCode != null && paperCode.isNotEmpty)
                Text(paperCode, style: OL.qcStyle),
              if (questionText != null && questionText.isNotEmpty) ...[
                if (paperCode != null && paperCode.isNotEmpty)
                  const SizedBox(height: 4),
                Text(questionText, style: OL.qtStyle),
              ],
            ],
          ),
        ),
        table, // ← REMOVED the extra Padding here
      ],
    );
  }
}
