// lib/widgets/service_picker.dart
//
// Cascading dropdown picker for MINEFOP government users:
//   Dropdown 1: Category  (Déconcentré / Administration Centrale / Organisme Rattaché)
//   Dropdown 2: Level-1 service (roots for that category)
//   Dropdown 3+: Sub-service levels (auto-loaded when a parent is selected)
//
// On any selection, calls onSelected(serviceNode) with the deepest chosen node.
// If a selected node has no children, it is the final selection.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../theme/app_colors.dart';

// ── Model ────────────────────────────────────────────────────────────────────

class MinefopServiceNode {
  final String id;
  final String code;
  final String category;
  final int level;
  final String? parentCode;
  final String name;
  final String? nameEn;
  final String? acronym;
  final String roleMapping;
  final bool requiresRegion;
  final bool requiresDepartment;
  final List<MinefopServiceNode> children;

  const MinefopServiceNode({
    required this.id,
    required this.code,
    required this.category,
    required this.level,
    this.parentCode,
    required this.name,
    this.nameEn,
    this.acronym,
    required this.roleMapping,
    required this.requiresRegion,
    required this.requiresDepartment,
    this.children = const [],
  });

  factory MinefopServiceNode.fromJson(Map<String, dynamic> j) {
    return MinefopServiceNode(
      id: j['id'] as String,
      code: j['code'] as String,
      category: j['category'] as String,
      level: j['level'] as int,
      parentCode: j['parentCode'] as String?,
      name: j['name'] as String,
      nameEn: j['nameEn'] as String?,
      acronym: j['acronym'] as String?,
      roleMapping: j['roleMapping'] as String,
      requiresRegion: j['requiresRegion'] as bool? ?? false,
      requiresDepartment: j['requiresDepartment'] as bool? ?? false,
      children: (j['children'] as List<dynamic>? ?? [])
          .map((c) => MinefopServiceNode.fromJson(c as Map<String, dynamic>))
          .toList(),
    );
  }

  String get displayName => acronym != null ? '$acronym — $name' : name;

  @override
  bool operator ==(Object other) =>
      other is MinefopServiceNode && other.code == code;

  @override
  int get hashCode => code.hashCode;
}

// ── Category definitions ─────────────────────────────────────────────────────

class _Category {
  final String value;
  final String label;
  final String sublabel;
  final IconData icon;
  final Color color;

  const _Category({
    required this.value,
    required this.label,
    required this.sublabel,
    required this.icon,
    required this.color,
  });
}

const _kCategories = [
  _Category(
    value: 'DECONCENTRE',
    label: 'Services Déconcentrés',
    sublabel: 'DREFOP · DDEFOP',
    icon: Icons.account_tree_outlined,
    color: Colors.indigo,
  ),
  _Category(
    value: 'CENTRALE',
    label: 'Administration Centrale',
    sublabel: 'SG · IG · DRMOE · DFOP · DAG · DPE · DEPC',
    icon: Icons.account_balance_outlined,
    color: Colors.deepPurple,
  ),
  _Category(
    value: 'RATTACHE',
    label: 'Organismes Rattachés',
    sublabel: 'FNE · CFPA · IPFPA · SAR · SM',
    icon: Icons.hub_outlined,
    color: Colors.teal,
  ),
];

// ── Widget ───────────────────────────────────────────────────────────────────

class ServicePicker extends ConsumerStatefulWidget {
  final void Function(MinefopServiceNode service) onSelected;
  final MinefopServiceNode? initialValue;

  const ServicePicker({
    super.key,
    required this.onSelected,
    this.initialValue,
  });

  @override
  ConsumerState<ServicePicker> createState() => _ServicePickerState();
}

class _ServicePickerState extends ConsumerState<ServicePicker> {
  String? _selectedCategory;

  // Parallel lists — one entry per dropdown level rendered
  // _levels[i]     = list of options shown in dropdown i
  // _selections[i] = currently chosen node in dropdown i (null = not chosen)
  List<List<MinefopServiceNode>> _levels = [];
  List<MinefopServiceNode?> _selections = [];

  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final init = widget.initialValue;
    if (init != null) {
      _selectedCategory = init.category;
      // Show the initial selection at its own level with a single-item list
      // so the dropdown is pre-populated. Full ancestor chain would require
      // extra API calls; showing the leaf directly is sufficient for draft restore.
      _levels = [
        [init]
      ];
      _selections = [init];
    }
  }

  // The deepest non-null selection is the effective service.
  MinefopServiceNode? get _effective {
    for (int i = _selections.length - 1; i >= 0; i--) {
      if (_selections[i] != null) return _selections[i];
    }
    return null;
  }

  _Category? get _activeCategory => _selectedCategory == null
      ? null
      : _kCategories.firstWhere(
          (c) => c.value == _selectedCategory,
          orElse: () => _kCategories.first,
        );

  // ── Loaders ─────────────────────────────────────────────────────────────────

  Future<void> _onCategoryChanged(String category) async {
    setState(() {
      _selectedCategory = category;
      _levels = [];
      _selections = [];
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get('/minefop-services/roots',
          queryParameters: {'category': category});
      final roots = (resp.data as List)
          .map((j) => MinefopServiceNode.fromJson(j as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          _levels = roots.isEmpty ? [] : [roots];
          _selections = roots.isEmpty ? [] : [null];
          _loading = false;
          if (roots.isEmpty) {
            _error =
                'Aucun service trouvé. Vérifiez que le serveur est déployé et les données initialisées.';
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error =
              'Impossible de charger les services ($e).\nVérifiez que le backend est déployé et accessible.';
        });
      }
    }
  }

  Future<void> _onLevelChanged(
      int levelIdx, MinefopServiceNode? selected) async {
    // Truncate everything deeper and record this selection
    setState(() {
      _selections = [..._selections.take(levelIdx), selected];
      _levels = _levels.take(levelIdx + 1).toList();
    });

    // Notify immediately with current (possibly non-leaf) selection
    if (selected != null) widget.onSelected(selected);

    if (selected == null) return;

    // Try to load children to add the next dropdown level
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get('/minefop-services/children',
          queryParameters: {'parentCode': selected.code});
      final children = (resp.data as List)
          .map((j) => MinefopServiceNode.fromJson(j as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          if (children.isNotEmpty) {
            _levels = [..._levels, children];
            _selections = [..._selections, null];
          }
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final cat = _activeCategory;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Category dropdown ────────────────────────────────────────────────
        const _Label('Type de service *'),
        DropdownButtonFormField<String>(
          initialValue: _selectedCategory,
          isExpanded: true,
          decoration: _decor('Sélectionner un type de service'),
          // Single-line items — sublabel shown separately below the dropdown
          items: _kCategories
              .map((c) => DropdownMenuItem(
                    value: c.value,
                    child: Row(children: [
                      Icon(c.icon, size: 16, color: c.color),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          c.label,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                    ]),
                  ))
              .toList(),
          onChanged: (v) {
            if (v != null) _onCategoryChanged(v);
          },
        ),
        // Sublabel shown under the dropdown (not inside the constrained item)
        if (_activeCategory != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(_activeCategory!.sublabel,
                style: const TextStyle(fontSize: 11, color: AppColors.slate)),
          ),

        // ── Loading indicator ────────────────────────────────────────────────
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Center(child: LinearProgressIndicator()),
          ),

        // ── Error banner ─────────────────────────────────────────────────────
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child:
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_error!,
                      style: const TextStyle(fontSize: 12, color: Colors.red)),
                ),
              ]),
            ),
          ),

        // ── Cascading level dropdowns ────────────────────────────────────────
        for (int i = 0; i < _levels.length; i++) ...[
          const SizedBox(height: 14),
          _Label(_levelLabel(i)),
          DropdownButtonFormField<MinefopServiceNode>(
            initialValue: _selections[i],
            isExpanded: true,
            decoration: _decor('Sélectionner...'),
            items: _levels[i]
                .map((node) => DropdownMenuItem(
                      value: node,
                      child: Text(
                        node.displayName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13),
                      ),
                    ))
                .toList(),
            onChanged: (v) => _onLevelChanged(i, v),
          ),
        ],

        // ── Selected summary card ────────────────────────────────────────────
        if (_effective != null && cat != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: cat.color.withAlpha(15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: cat.color.withAlpha(70)),
            ),
            child: Row(children: [
              Icon(Icons.check_circle, size: 18, color: cat.color),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Service sélectionné',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: cat.color)),
                    const SizedBox(height: 2),
                    Text(_effective!.name,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w500)),
                    if (_effective!.acronym != null)
                      Text(_effective!.acronym!,
                          style: TextStyle(fontSize: 11, color: cat.color)),
                    const SizedBox(height: 4),
                    _Chip(
                        label: 'Rôle: ${_effective!.roleMapping}',
                        color: cat.color),
                    if (_effective!.requiresRegion)
                      const _Chip(
                          label: 'Nécessite une région', color: Colors.orange),
                    if (_effective!.requiresDepartment)
                      const _Chip(
                          label: 'Nécessite un département',
                          color: Colors.orange),
                  ],
                ),
              ),
            ]),
          ),
        ],
      ],
    );
  }

  String _levelLabel(int i) {
    if (i == 0) return 'Direction / Délégation *';
    if (i == 1) return 'Sous-direction / Service';
    return 'Bureau / Cellule';
  }

  InputDecoration _decor(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 13),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        filled: true,
        fillColor: Colors.white,
      );
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.slate)),
      );
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: color.withAlpha(20),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 10, color: color, fontWeight: FontWeight.w600)),
        ),
      );
}
