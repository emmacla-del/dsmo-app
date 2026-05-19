// departures_table.dart
//
// S3Q01 — Départs enregistrés par CSP, type de départ et sexe
//
// Paper form layout (image 1, top table):
//
//  ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
//  │  CSP/ SPC    │Licenciements/│  Démissions/ │Départ retr./ │Autres dépts/ │ Ensemble/    │
//  │              │  Dismissal   │  Resignation │  Retirement  │Other depart. │   Whole      │
//  │              ├───┬───┬──────┼───┬───┬──────┼───┬───┬──────┼───┬───┬──────┼───┬───┬──────┤
//  │              │ M │ F │  T   │ M │ F │  T   │ M │ F │  T   │ M │ F │  T   │ M │ F │  T   │
//  ├──────────────┼───┼───┼──────┼───┼───┼──────┼───┼───┼──────┼───┼───┼──────┼───┼───┼──────┤
//  │ Cadres/...   │   │   │      │   │   │      │   │   │      │   │   │      │   │   │      │
//  │ Agents M./.. │   │   │      │   │   │      │   │   │      │   │   │      │   │   │      │
//  │ Agents ex./..│   │   │      │   │   │      │   │   │      │   │   │      │   │   │      │
//  │ Total        │ ∑ │ ∑ │  ∑   │ ∑ │ ∑ │  ∑   │ ∑ │ ∑ │  ∑   │ ∑ │ ∑ │  ∑   │ ∑ │ ∑ │  ∑   │
//  └──────────────┴───┴───┴──────┴───┴───┴──────┴───┴───┴──────┴───┴───┴──────┴───┴───┴──────┘

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../onefop_form_models.dart';
import '../../../core/theme/onefop_colors.dart';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/// [data] maps cspKey → typeKey → MFTCount
/// cspKeys:  'executives', 'foremen', 'fieldWorkers', 'total'
/// typeKeys: 'dismissals', 'resignations', 'retirements', 'others', 'ensemble'
Widget departuresTable({
  required Map<String, Map<String, MFTCount>> data,
  required VoidCallback onChanged,
}) {
  return _DeparturesTable(data: data, onChanged: onChanged);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// CSP rows (excludes 'total' — rendered as footer)
const _kCspRows = [
  ('executives', 'Cadres/ Executives'),
  ('foremen', 'Agents de Maitrise/ Foremen'),
  ('fieldWorkers', "Agents d'execution/ Field workers"),
];

// Departure type columns — 5 groups each with M/F/T
const _kTypes = [
  ('dismissals', 'Licenciements/\nDismissal'),
  ('resignations', 'Demissions/\nResignation'),
  ('retirements', 'Depart retraite/\nRetirement'),
  ('others', 'Autres departs/\nOther departure'),
  ('ensemble', 'Ensemble/\nWhole'),
];

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const int _kLabel = 4; // CSP label column
const int _kMF = 2; // M and F editable cells
const int _kT = 2; // T computed cell per group

const _kLine = OnefopColors.border;
const _kGroupLine = OnefopColors.teal;

const _cellBorder = Border(
  right: BorderSide(color: _kLine, width: 0.5),
  bottom: BorderSide(color: _kLine, width: 0.5),
);
const _groupBorder = Border(
  left: BorderSide(color: _kGroupLine, width: 1.5),
  right: BorderSide(color: _kLine, width: 0.5),
  bottom: BorderSide(color: _kLine, width: 0.5),
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WIDGET
// ─────────────────────────────────────────────────────────────────────────────

class _DeparturesTable extends StatefulWidget {
  final Map<String, Map<String, MFTCount>> data;
  final VoidCallback onChanged;
  const _DeparturesTable({required this.data, required this.onChanged});

  @override
  State<_DeparturesTable> createState() => _DeparturesTableState();
}

class _DeparturesTableState extends State<_DeparturesTable> {
  void _update(String cspKey, String typeKey, bool isMale, int value) {
    setState(() {
      final count = widget.data[cspKey]![typeKey]!;
      if (isMale) {
        count.male = value;
      } else {
        count.female = value;
      }
      count.recalcTotal();
      _recompute();
    });
    widget.onChanged();
  }

  void _recompute() {
    // Column totals (sum across CSP rows)
    for (final (typeKey, _) in _kTypes) {
      final tot = widget.data['total']![typeKey]!;
      tot.male = _kCspRows.fold<int>(
          0, (s, r) => s + (widget.data[r.$1]?[typeKey]?.male ?? 0));
      tot.female = _kCspRows.fold<int>(
          0, (s, r) => s + (widget.data[r.$1]?[typeKey]?.female ?? 0));
      tot.recalcTotal();
    }
    // Ensemble = sum of all other types per CSP row
    for (final (cspKey, _) in [..._kCspRows, ('total', '')]) {
      final ens = widget.data[cspKey]!['ensemble']!;
      ens.male = _kTypes
          .where((t) => t.$1 != 'ensemble')
          .fold<int>(0, (s, t) => s + (widget.data[cspKey]?[t.$1]?.male ?? 0));
      ens.female = _kTypes.where((t) => t.$1 != 'ensemble').fold<int>(
          0, (s, t) => s + (widget.data[cspKey]?[t.$1]?.female ?? 0));
      ens.recalcTotal();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: _kLine, width: 0.5),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _headerRow1(),
          _headerRow2(),
          for (final (key, label) in _kCspRows) _dataRow(key, label),
          _footerRow(),
        ],
      ),
    );
  }

  // ── HEADER ROW 1: CSP label + 5 departure type group headers ─────────────

  Widget _headerRow1() {
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(flex: _kLabel, child: _hCell('CSP/ SPC', border: _cellBorder)),
        for (final (_, typeLabel) in _kTypes)
          Expanded(
            flex: (_kMF * 2 + _kT),
            child: _hCell(typeLabel, border: _groupBorder, highlight: true),
          ),
      ]),
    );
  }

  // ── HEADER ROW 2: empty label + M/F/T per group ───────────────────────────

  Widget _headerRow2() {
    List<Widget> mftHeaders({required bool group}) => [
          Expanded(
              flex: _kMF,
              child: _hCell('M',
                  border: group ? _groupBorder : _cellBorder, sub: true)),
          Expanded(
              flex: _kMF, child: _hCell('F', border: _cellBorder, sub: true)),
          Expanded(
              flex: _kT,
              child: _hCell('T',
                  border: _cellBorder,
                  sub: true,
                  bgColor: OnefopColors.teal.withAlpha(15))),
        ];

    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(
            flex: _kLabel,
            child: Container(
                decoration: const BoxDecoration(border: _cellBorder))),
        for (int i = 0; i < _kTypes.length; i++) ...mftHeaders(group: true),
      ]),
    );
  }

  // ── DATA ROW: one CSP category ────────────────────────────────────────────

  Widget _dataRow(String cspKey, String label) {
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(flex: _kLabel, child: _labelCell(label)),
        for (final (typeKey, _) in _kTypes) ...[
          // M editable (ensemble is always computed — read-only)
          Expanded(
            flex: _kMF,
            child: typeKey == 'ensemble'
                ? _readCell(widget.data[cspKey]?[typeKey]?.male ?? 0,
                    border: _groupBorder)
                : _EditCell(
                    value: widget.data[cspKey]?[typeKey]?.male ?? 0,
                    onChanged: (v) => _update(cspKey, typeKey, true, v),
                    border: _groupBorder),
          ),
          // F editable (ensemble read-only)
          Expanded(
            flex: _kMF,
            child: typeKey == 'ensemble'
                ? _readCell(widget.data[cspKey]?[typeKey]?.female ?? 0)
                : _EditCell(
                    value: widget.data[cspKey]?[typeKey]?.female ?? 0,
                    onChanged: (v) => _update(cspKey, typeKey, false, v)),
          ),
          // T always read-only
          Expanded(
            flex: _kT,
            child: _readCell(widget.data[cspKey]?[typeKey]?.total ?? 0,
                strong: typeKey == 'ensemble'),
          ),
        ],
      ]),
    );
  }

  // ── FOOTER ROW: TOTAL ─────────────────────────────────────────────────────

  Widget _footerRow() {
    final tot = widget.data['total']!;
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(flex: _kLabel, child: _totalLabelCell()),
        for (final (typeKey, _) in _kTypes) ...[
          Expanded(
              flex: _kMF,
              child: _readCell(tot[typeKey]?.male ?? 0,
                  totalRow: true, border: _groupBorder)),
          Expanded(
              flex: _kMF,
              child: _readCell(tot[typeKey]?.female ?? 0, totalRow: true)),
          Expanded(
              flex: _kT,
              child: _readCell(tot[typeKey]?.total ?? 0,
                  totalRow: true, strong: true)),
        ],
      ]),
    );
  }

  // ── CELL BUILDERS ─────────────────────────────────────────────────────────

  Widget _hCell(
    String text, {
    required Border border,
    bool sub = false,
    bool highlight = false,
    Color? bgColor,
  }) {
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor ??
            (highlight
                ? OnefopColors.surface
                : sub
                    ? OnefopColors.surface.withAlpha(180)
                    : OnefopColors.card),
        border: border,
      ),
      child: Text(text,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: sub ? 10 : 11,
            fontWeight: sub ? FontWeight.w500 : FontWeight.w700,
            color: sub ? OnefopColors.white60 : OnefopColors.white,
            height: 1.4,
          )),
    );
  }

  Widget _labelCell(String label) => Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: const BoxDecoration(border: _cellBorder),
        child: Text(label,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: OnefopColors.white,
                height: 1.4)),
      );

  Widget _totalLabelCell() => Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
            color: OnefopColors.teal.withAlpha(20), border: _cellBorder),
        child: const Text('Total',
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: OnefopColors.teal)),
      );

  Widget _readCell(
    int value, {
    Border border = _cellBorder,
    bool strong = false,
    bool totalRow = false,
  }) {
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: totalRow
            ? OnefopColors.teal.withAlpha(20)
            : OnefopColors.teal.withAlpha(10),
        border: border,
      ),
      child: Text('$value',
          style: TextStyle(
            fontSize: strong ? 12 : 11,
            fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
            color: OnefopColors.teal,
          )),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT CELL — identical pattern to csp_block.dart
// ─────────────────────────────────────────────────────────────────────────────

class _EditCell extends StatefulWidget {
  final int value;
  final ValueChanged<int> onChanged;
  final Border border;

  const _EditCell({
    required this.value,
    required this.onChanged,
    this.border = _cellBorder,
  });

  @override
  State<_EditCell> createState() => _EditCellState();
}

class _EditCellState extends State<_EditCell> {
  late final TextEditingController _ctrl;
  late final FocusNode _focus;
  bool _active = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: _disp(widget.value));
    _focus = FocusNode()
      ..addListener(() {
        setState(() => _active = _focus.hasFocus);
        if (!_focus.hasFocus) _commit();
      });
  }

  @override
  void didUpdateWidget(_EditCell old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value && !_focus.hasFocus) {
      _ctrl.text = _disp(widget.value);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  String _disp(int v) => v == 0 ? '' : '$v';

  void _commit() {
    final v = int.tryParse(_ctrl.text) ?? 0;
    if (v != widget.value) widget.onChanged(v);
    if (v == 0 && _ctrl.text.isNotEmpty) _ctrl.text = '';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _active ? OnefopColors.teal.withAlpha(15) : Colors.transparent,
        border: _active
            ? const Border.fromBorderSide(
                BorderSide(color: OnefopColors.teal, width: 1.5))
            : widget.border,
      ),
      child: TextField(
        controller: _ctrl,
        focusNode: _focus,
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        textInputAction: TextInputAction.done,
        style: const TextStyle(fontSize: 12, color: OnefopColors.white),
        decoration: const InputDecoration(
          hintText: '—',
          hintStyle: TextStyle(color: OnefopColors.border, fontSize: 11),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          isDense: true,
          contentPadding: EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        ),
        onChanged: (v) => widget.onChanged(int.tryParse(v) ?? 0),
        onSubmitted: (_) {
          _commit();
          FocusScope.of(context).nextFocus();
        },
      ),
    );
  }
}
