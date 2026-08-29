// lib/core/focus/renderers/activities_table.dart
//
// Projects & Programs — Section 2's "activities/services offered" table.
// A variable-count, heterogeneous-column repeating table (free-text
// description + three coded categoricals + a start date + a duration per
// row) — structurally unlike every other ONEFOP table (a fixed numeric
// matrix), so it deliberately does NOT route through GridRenderSpec/
// TableSpecBuilder/TableCellEngine at all. See AstFieldType.repeatingTable.
//
// Persistence reuses the existing hybrid-text-controller mechanism
// (OnefopFormController.hybridController) unchanged — the same one
// already backing the app's 3-row free-entry tables (reasons/skills/
// training), just generalized to 6 fields x up to 13 rows. Every cell,
// including the coded dropdowns, is a hybrid-controller-backed string
// value; a listener on each controller already writes through to
// OnefopFormController._data and schedules autosave, so this widget
// needs no bespoke persistence plumbing of its own.

import 'package:flutter/material.dart';

import '../../i18n/localized_text.dart';
import '../../../screens/onefop/onefop_form_constants.dart';

class ActivitiesTableField {
  final String key;
  final LocalizedText label;
  final LocalizedText hint;
  // null = free-text field; non-null = coded dropdown with these options
  // (value, label).
  final List<MapEntry<String, LocalizedText>>? options;
  const ActivitiesTableField(this.key, this.label, this.hint, {this.options});
}

/// Field definitions, in display order — one static source of truth for
/// both the dropdown option lists and the flat-key suffixes used by
/// OnefopFormController.hybridController and the backend normalizer
/// (`${prefix}_row{n}_{key}`).
const List<ActivitiesTableField> kActivitiesTableFields = [
  ActivitiesTableField(
    'description',
    LocalizedText(fr: 'Prestations offertes', en: 'Services offered'),
    LocalizedText(fr: 'Décrire la prestation', en: 'Describe the service'),
  ),
  ActivitiesTableField(
    'targetPopulation',
    LocalizedText(fr: 'Population cible', en: 'Target population'),
    LocalizedText(fr: 'Choisir', en: 'Choose'),
    options: [
      MapEntry('1', LocalizedText(fr: 'Jeune non diplômé', en: 'Non-graduate youth')),
      MapEntry('2', LocalizedText(fr: 'Jeune diplômé', en: 'Graduate youth')),
      MapEntry('3', LocalizedText(fr: 'Femme', en: 'Women')),
      MapEntry('4', LocalizedText(fr: 'Monde rural', en: 'Rural')),
      MapEntry('5', LocalizedText(fr: 'Population urbaine', en: 'Urban population')),
      MapEntry('6', LocalizedText(fr: 'Autre', en: 'Other')),
    ],
  ),
  ActivitiesTableField(
    'supportType',
    LocalizedText(fr: "Nature de l'appui", en: 'Type of support'),
    LocalizedText(fr: 'Choisir', en: 'Choose'),
    options: [
      MapEntry('1', LocalizedText(fr: 'Gratuit', en: 'Free')),
      MapEntry('2', LocalizedText(fr: 'Tarifé', en: 'Fee-based')),
      MapEntry('3', LocalizedText(
          fr: 'Aide financière remboursable', en: 'Reimbursable financial assistance')),
      MapEntry('4', LocalizedText(
          fr: 'Aide financière non remboursable',
          en: 'Non-reimbursable financial assistance')),
      MapEntry('5', LocalizedText(fr: 'Autre', en: 'Other')),
    ],
  ),
  ActivitiesTableField(
    'scope',
    LocalizedText(fr: "Rayon d'action", en: 'Scope of action'),
    LocalizedText(fr: 'Choisir', en: 'Choose'),
    options: [
      MapEntry('1', LocalizedText(fr: 'National', en: 'National')),
      MapEntry('2', LocalizedText(fr: 'Régional', en: 'Regional')),
      MapEntry('3', LocalizedText(fr: 'Local', en: 'Local')),
      MapEntry('4', LocalizedText(fr: 'Autre', en: 'Other')),
    ],
  ),
  ActivitiesTableField(
    'startDate',
    LocalizedText(fr: 'Date de début', en: 'Start date'),
    LocalizedText(fr: 'MM/AAAA', en: 'MM/YYYY'),
  ),
  ActivitiesTableField(
    'duration',
    LocalizedText(fr: 'Durée (mois)', en: 'Duration (months)'),
    LocalizedText(fr: '0', en: '0'),
  ),
];

/// Row capacity matching the paper form (Questionnaire_Projet_et_
/// Programmes.pdf's Section 2 shows exactly 13 blank rows) — a display
/// capacity, not a hard cap; see onefop_ast.dart's PP_S2_ACTIVITIES.
const int kActivitiesTableRowCount = 13;

/// Flat-key suffixes for each of a row's 6 fields, in the order used to
/// build `${prefix}_row{n}_{suffix}` hybrid-controller ids — shared
/// between this widget, OnefopFormController._initHybrid, and (on the
/// backend) the flat-key normalizer.
List<String> get kActivitiesTableFieldSuffixes =>
    kActivitiesTableFields.map((f) => f.key).toList();

class ActivitiesTable extends StatefulWidget {
  final String prefix;
  final int rows;
  final TextEditingController Function(String id) hybridController;

  const ActivitiesTable({
    super.key,
    required this.prefix,
    required this.rows,
    required this.hybridController,
  });

  @override
  State<ActivitiesTable> createState() => _ActivitiesTableState();
}

class _ActivitiesTableState extends State<ActivitiesTable> {
  // DropdownButtonFormField's displayed selection is driven by its own
  // `value:` prop, not by the backing TextEditingController (unlike a
  // plain TextField) — this widget's local rebuild is what keeps a
  // dropdown's visible selection in sync after onChanged. The
  // TextEditingController itself remains the single source of truth for
  // persistence (see the file-level comment).
  late final Map<String, String> _dropdownValues;

  @override
  void initState() {
    super.initState();
    _dropdownValues = {
      for (var n = 1; n <= widget.rows; n++)
        for (final f in kActivitiesTableFields)
          if (f.options != null)
            '${widget.prefix}_row${n}_${f.key}':
                widget.hybridController('${widget.prefix}_row${n}_${f.key}').text,
    };
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var n = 1; n <= widget.rows; n++) _buildRow(n, locale),
      ],
    );
  }

  Widget _buildRow(int n, Locale locale) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kSurface,
        border: Border.all(color: kBorder),
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${const LocalizedText(fr: 'Ligne', en: 'Row').of(locale)} $n',
            style: const TextStyle(fontWeight: FontWeight.w600, color: kInk, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final f in kActivitiesTableFields) _buildField(n, f, locale),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildField(int n, ActivitiesTableField f, Locale locale) {
    final id = '${widget.prefix}_row${n}_${f.key}';
    final width = f.key == 'description' ? 260.0 : 160.0;
    if (f.options != null) {
      return SizedBox(
        width: width,
        child: DropdownButtonFormField<String>(
          value: (_dropdownValues[id]?.isEmpty ?? true) ? null : _dropdownValues[id],
          isExpanded: true,
          decoration: InputDecoration(
            labelText: f.label.of(locale),
            filled: true,
            fillColor: kFieldFill,
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(kRadiusSm),
              borderSide: const BorderSide(color: kBorder),
            ),
          ),
          items: [
            for (final o in f.options!)
              DropdownMenuItem(value: o.key, child: Text('${o.key} — ${o.value.of(locale)}')),
          ],
          onChanged: (v) {
            widget.hybridController(id).text = v ?? '';
            setState(() => _dropdownValues[id] = v ?? '');
          },
        ),
      );
    }
    return SizedBox(
      width: width,
      child: TextFormField(
        controller: widget.hybridController(id),
        keyboardType: f.key == 'duration' ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(
          labelText: f.label.of(locale),
          hintText: f.hint.of(locale),
          filled: true,
          fillColor: kFieldFill,
          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(kRadiusSm),
            borderSide: const BorderSide(color: kBorder),
          ),
        ),
      ),
    );
  }
}
