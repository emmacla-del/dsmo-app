// lib/widgets/period_selector.dart
import 'package:flutter/material.dart';

enum PeriodType { year, quarter, semester, custom }

class PeriodConfig {
  final PeriodType type;
  final int? year;
  final String? quarter;
  final String? semester;
  final DateTimeRange? customRange;

  const PeriodConfig({
    required this.type,
    this.year,
    this.quarter,
    this.semester,
    this.customRange,
  });

  // Every screen/tab derives its own PeriodConfig instance from
  // dashboardFilterProvider via the .period getter, then passes it into
  // FutureProvider.family<_, PeriodConfig>. Without value equality, each
  // call site gets a distinct cache key — identical filters fan out into
  // duplicate, uncached network requests instead of sharing one result.
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PeriodConfig &&
          type == other.type &&
          year == other.year &&
          quarter == other.quarter &&
          semester == other.semester &&
          customRange == other.customRange;

  @override
  int get hashCode => Object.hash(type, year, quarter, semester, customRange);

  Map<String, dynamic> toApiParams() {
    switch (type) {
      case PeriodType.year:
        return {'year': year ?? DateTime.now().year};
      case PeriodType.quarter:
        return {
          'fromQuarter': '${year ?? DateTime.now().year}-$quarter',
          'toQuarter': '${year ?? DateTime.now().year}-$quarter',
        };
      case PeriodType.semester:
        final yearNum = year ?? DateTime.now().year;
        if (semester == 'S1') {
          return {'fromQuarter': '$yearNum-T1', 'toQuarter': '$yearNum-T2'};
        } else {
          return {'fromQuarter': '$yearNum-T3', 'toQuarter': '$yearNum-T4'};
        }
      case PeriodType.custom:
        return {
          'startDate': customRange?.start.toIso8601String(),
          'endDate': customRange?.end.toIso8601String(),
        };
    }
  }

  /// Same period one year earlier — used for year-on-year comparisons.
  PeriodConfig get previousYearPeriod {
    final y = (year ?? DateTime.now().year) - 1;
    switch (type) {
      case PeriodType.year:
        return PeriodConfig(type: type, year: y);
      case PeriodType.quarter:
        return PeriodConfig(type: type, year: y, quarter: quarter);
      case PeriodType.semester:
        return PeriodConfig(type: type, year: y, semester: semester);
      case PeriodType.custom:
        if (customRange == null) return this;
        const shift = Duration(days: 365);
        return PeriodConfig(
          type: type,
          customRange: DateTimeRange(
            start: customRange!.start.subtract(shift),
            end: customRange!.end.subtract(shift),
          ),
        );
    }
  }

  String get displayText {
    switch (type) {
      case PeriodType.year:
        return '$year';
      case PeriodType.quarter:
        return '$year $quarter';
      case PeriodType.semester:
        return '$year $semester';
      case PeriodType.custom:
        if (customRange != null) {
          return '${_formatDate(customRange!.start)} → ${_formatDate(customRange!.end)}';
        }
        return 'Période personnalisée';
    }
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

class PeriodSelector extends StatefulWidget {
  final PeriodType initialType;
  final int? initialYear;
  final String? initialQuarter;
  final String? initialSemester;
  final DateTimeRange? initialCustomRange;
  final Function(PeriodConfig) onChanged;

  const PeriodSelector({
    super.key,
    this.initialType = PeriodType.year,
    this.initialYear,
    this.initialQuarter,
    this.initialSemester,
    this.initialCustomRange,
    required this.onChanged,
  });

  @override
  State<PeriodSelector> createState() => _PeriodSelectorState();
}

class _PeriodSelectorState extends State<PeriodSelector> {
  late PeriodType _type;
  late int _year;
  late String? _quarter;
  late String? _semester;
  late DateTimeRange? _customRange;

  final int _currentYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _type = widget.initialType;
    _year = widget.initialYear ?? _currentYear;
    _quarter = widget.initialQuarter ?? 'T1';
    _semester = widget.initialSemester ?? 'S1';
    _customRange = widget.initialCustomRange;
  }

  void _notifyChange() {
    widget.onChanged(PeriodConfig(
      type: _type,
      year: _year,
      quarter: _quarter,
      semester: _semester,
      customRange: _customRange,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Période d\'analyse',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            // Period type selector as segmented buttons
            Row(
              children: [
                _buildPeriodButton('Année', PeriodType.year),
                const SizedBox(width: 8),
                _buildPeriodButton('Trimestre', PeriodType.quarter),
                const SizedBox(width: 8),
                _buildPeriodButton('Semestre', PeriodType.semester),
                const SizedBox(width: 8),
                _buildPeriodButton('Personnalisé', PeriodType.custom),
              ],
            ),
            const SizedBox(height: 12),
            // Period-specific controls
            if (_type == PeriodType.year) _buildYearSelector(),
            if (_type == PeriodType.quarter) _buildQuarterSelector(),
            if (_type == PeriodType.semester) _buildSemesterSelector(),
            if (_type == PeriodType.custom) _buildCustomRangeSelector(),
          ],
        ),
      ),
    );
  }

  Widget _buildPeriodButton(String label, PeriodType type) {
    final isSelected = _type == type;
    return Expanded(
      child: ElevatedButton(
        onPressed: () {
          setState(() {
            _type = type;
          });
          _notifyChange();
        },
        style: ElevatedButton.styleFrom(
          backgroundColor:
              isSelected ? const Color(0xFF1D9E75) : Colors.grey.shade200,
          foregroundColor: isSelected ? Colors.white : Colors.black87,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: Text(label, style: const TextStyle(fontSize: 12)),
      ),
    );
  }

  Widget _buildYearSelector() {
    return DropdownButtonFormField<int>(
      isExpanded: true,
      value: _year,
      decoration: const InputDecoration(
        labelText: 'Année',
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      items: List.generate(6, (i) => _currentYear - i)
          .map((y) => DropdownMenuItem(
                value: y,
                child: Text(y.toString(), overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: (v) {
        setState(() => _year = v!);
        _notifyChange();
      },
    );
  }

  Widget _buildQuarterSelector() {
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<int>(
            isExpanded: true,
            value: _year,
            decoration: const InputDecoration(
              labelText: 'Année',
              border: OutlineInputBorder(),
            ),
            items: List.generate(6, (i) => _currentYear - i)
                .map((y) => DropdownMenuItem(
                      value: y,
                      child: Text(y.toString(), overflow: TextOverflow.ellipsis),
                    ))
                .toList(),
            onChanged: (v) {
              setState(() => _year = v!);
              _notifyChange();
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: DropdownButtonFormField<String>(
            isExpanded: true,
            value: _quarter,
            decoration: const InputDecoration(
              labelText: 'Trimestre',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                  value: 'T1',
                  child: Text('T1 (Jan-Mar)', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'T2',
                  child: Text('T2 (Avr-Jun)', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'T3',
                  child: Text('T3 (Jul-Sep)', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'T4',
                  child: Text('T4 (Oct-Dec)', overflow: TextOverflow.ellipsis)),
            ],
            onChanged: (v) {
              setState(() => _quarter = v);
              _notifyChange();
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSemesterSelector() {
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<int>(
            isExpanded: true,
            value: _year,
            decoration: const InputDecoration(
              labelText: 'Année',
              border: OutlineInputBorder(),
            ),
            items: List.generate(6, (i) => _currentYear - i)
                .map((y) => DropdownMenuItem(
                      value: y,
                      child: Text(y.toString(), overflow: TextOverflow.ellipsis),
                    ))
                .toList(),
            onChanged: (v) {
              setState(() => _year = v!);
              _notifyChange();
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: DropdownButtonFormField<String>(
            isExpanded: true,
            value: _semester,
            decoration: const InputDecoration(
              labelText: 'Semestre',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                  value: 'S1',
                  child: Text('S1 (Jan-Jun)', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'S2',
                  child: Text('S2 (Jul-Dec)', overflow: TextOverflow.ellipsis)),
            ],
            onChanged: (v) {
              setState(() => _semester = v);
              _notifyChange();
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCustomRangeSelector() {
    return InkWell(
      onTap: () async {
        final picked = await showDateRangePicker(
          context: context,
          firstDate: DateTime(2020),
          lastDate: DateTime.now(),
          initialDateRange: _customRange,
        );
        if (picked != null) {
          setState(() => _customRange = picked);
          _notifyChange();
        }
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            const Icon(Icons.date_range, color: Color(0xFF1D9E75)),
            const SizedBox(width: 12),
            Text(
              _customRange != null
                  ? '${_formatDate(_customRange!.start)} → ${_formatDate(_customRange!.end)}'
                  : 'Sélectionner une période',
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}
