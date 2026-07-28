import 'package:flutter/material.dart';
import '../../data/api_client.dart';

class Region {
  final String id;
  final String name;
  const Region({required this.id, required this.name});
  factory Region.fromJson(Map<String, dynamic> j) =>
      Region(id: j['id'] as String, name: j['name'] as String);
}

class Department {
  final String id;
  final String name;
  const Department({required this.id, required this.name});
  factory Department.fromJson(Map<String, dynamic> j) =>
      Department(id: j['id'] as String, name: j['name'] as String);
}

/// Cascading region → department checkbox picker. Departments are cached
/// per region (by id) so re-expanding an already-loaded region doesn't
/// refetch, and so deselecting a region can clean up its department
/// selections even if that region isn't the one currently expanded.
class RegionDepartmentSelector extends StatefulWidget {
  final ApiClient api;
  final Set<String> initialRegionNames;
  final Set<String> initialDepartmentNames;
  final ValueChanged<Set<String>> onRegionsChanged;
  final ValueChanged<Set<String>> onDepartmentsChanged;

  const RegionDepartmentSelector({
    super.key,
    required this.api,
    required this.initialRegionNames,
    required this.initialDepartmentNames,
    required this.onRegionsChanged,
    required this.onDepartmentsChanged,
  });

  @override
  State<RegionDepartmentSelector> createState() =>
      _RegionDepartmentSelectorState();
}

class _RegionDepartmentSelectorState extends State<RegionDepartmentSelector> {
  List<Region> _regions = [];
  final Map<String, List<Department>> _departmentsByRegion = {};
  final Set<String> _loadingRegionIds = {};
  late Set<String> _selectedRegionNames;
  late Set<String> _selectedDepartmentNames;
  bool _loadingRegions = true;
  String? _loadError;
  String? _expandedRegionId;

  @override
  void initState() {
    super.initState();
    _selectedRegionNames = {...widget.initialRegionNames};
    _selectedDepartmentNames = {...widget.initialDepartmentNames};
    _loadRegions();
  }

  Future<void> _loadRegions() async {
    setState(() {
      _loadingRegions = true;
      _loadError = null;
    });
    try {
      final data = await widget.api.getRegions();
      setState(() {
        _regions = data
            .whereType<Map<String, dynamic>>()
            .map(Region.fromJson)
            .toList();
        _loadingRegions = false;
      });
    } catch (_) {
      setState(() {
        _loadingRegions = false;
        _loadError = 'Impossible de charger les régions.';
      });
    }
  }

  Future<void> _toggleExpand(Region region) async {
    if (_expandedRegionId == region.id) {
      setState(() => _expandedRegionId = null);
      return;
    }
    setState(() => _expandedRegionId = region.id);
    if (_departmentsByRegion.containsKey(region.id)) return;

    setState(() => _loadingRegionIds.add(region.id));
    try {
      final data = await widget.api.getDepartments(region.id);
      setState(() {
        _departmentsByRegion[region.id] = data
            .whereType<Map<String, dynamic>>()
            .map(Department.fromJson)
            .toList();
        _loadingRegionIds.remove(region.id);
      });
    } catch (_) {
      setState(() => _loadingRegionIds.remove(region.id));
    }
  }

  void _selectAllRegions() {
    setState(() {
      _selectedRegionNames.clear();
      _selectedDepartmentNames.clear();
    });
    widget.onRegionsChanged(_selectedRegionNames);
    widget.onDepartmentsChanged(_selectedDepartmentNames);
  }

  void _setRegionSelected(Region region, bool selected) {
    setState(() {
      if (selected) {
        _selectedRegionNames.add(region.name);
      } else {
        _selectedRegionNames.remove(region.name);
        final depts = _departmentsByRegion[region.id] ?? const <Department>[];
        for (final d in depts) {
          _selectedDepartmentNames.remove(d.name);
        }
      }
    });
    widget.onRegionsChanged(_selectedRegionNames);
    widget.onDepartmentsChanged(_selectedDepartmentNames);
  }

  void _setDepartmentSelected(Region region, Department dept, bool selected) {
    setState(() {
      if (selected) {
        _selectedDepartmentNames.add(dept.name);
        _selectedRegionNames.add(region.name);
      } else {
        _selectedDepartmentNames.remove(dept.name);
      }
    });
    widget.onDepartmentsChanged(_selectedDepartmentNames);
    widget.onRegionsChanged(_selectedRegionNames);
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingRegions) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_loadError != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.red.shade200),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline, color: Colors.red.shade600, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(_loadError!,
                  style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
            ),
            TextButton(onPressed: _loadRegions, child: const Text('Réessayer')),
          ],
        ),
      );
    }
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          CheckboxListTile(
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12),
            dense: true,
            title: const Text(
              'Toutes les régions',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            value: _selectedRegionNames.isEmpty,
            onChanged: (v) {
              if (v == true) _selectAllRegions();
            },
          ),
          Divider(height: 1, color: Colors.grey.shade300),
          ..._regions.asMap().entries.map((entry) {
            final i = entry.key;
            final region = entry.value;
            final isExpanded = _expandedRegionId == region.id;
            final regionSelected = _selectedRegionNames.contains(region.name);
            final isLoadingDepts = _loadingRegionIds.contains(region.id);
            final depts =
                _departmentsByRegion[region.id] ?? const <Department>[];

            return Column(
              children: [
                if (i > 0) Divider(height: 1, color: Colors.grey.shade200),
                InkWell(
                  onTap: () => _toggleExpand(region),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Checkbox(
                          value: regionSelected,
                          onChanged: (v) =>
                              _setRegionSelected(region, v == true),
                        ),
                        Expanded(
                          child: Text(
                            region.name,
                            style: TextStyle(
                              fontWeight: regionSelected
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                          ),
                        ),
                        Icon(
                          isExpanded
                              ? Icons.keyboard_arrow_up
                              : Icons.keyboard_arrow_down,
                          color: Colors.grey.shade500,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),
                if (isExpanded)
                  Container(
                    color: Colors.grey.shade50,
                    child: isLoadingDepts
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: Center(
                                child: SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))),
                          )
                        : depts.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(12),
                                child: Text(
                                  'Aucun département disponible',
                                  style: TextStyle(
                                      color: Colors.grey.shade500,
                                      fontSize: 13),
                                ),
                              )
                            : Column(
                                children: depts.map((dept) {
                                  final deptSelected = _selectedDepartmentNames
                                      .contains(dept.name);
                                  return CheckboxListTile(
                                    dense: true,
                                    contentPadding: const EdgeInsets.only(
                                        left: 32, right: 12),
                                    title: Text(dept.name,
                                        style: const TextStyle(fontSize: 13)),
                                    value: deptSelected,
                                    onChanged: (v) => _setDepartmentSelected(
                                        region, dept, v == true),
                                  );
                                }).toList(),
                              ),
                  ),
              ],
            );
          }),
        ],
      ),
    );
  }
}
