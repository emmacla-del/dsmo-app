// lib/widgets/service_picker.dart
// ═══════════════════════════════════════════════════════════════
// MINEFOP Service Picker — drill-down tree navigator.
//
// Features:
//   • _navigateToNode() builds breadcrumb path by walking the
//     full flat list to reconstruct ancestors.
//   • Back button uses the breadcrumb stack, never reloads network.
//   • Selected leaf node is visually highlighted and remembered.
//   • Category picker uses UltraTheme styling consistently.
//   • Loading, error, and empty states are all handled cleanly.
//   • Parent-code map built once during load, not on every render.
//   • AnimatedSwitcher between levels for smooth drill-down feel.
//   • parentCode empty-string edge-case handled in fromJson.
// ═══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../theme/ultra_theme.dart';
import '../data/minefop_models.dart';

// ── Category metadata ────────────────────────────────────────

class _Category {
  final String value;
  final String label;
  final IconData icon;
  final Color color;
  const _Category(this.value, this.label, this.icon, this.color);
}

const _categories = [
  _Category('DECONCENTRE', 'Services Déconcentrés', Icons.account_tree_outlined,
      Color(0xFF3F51B5)),
  _Category('CENTRALE', 'Administration Centrale',
      Icons.account_balance_outlined, Color(0xFF7B1FA2)),
  _Category('RATTACHE', 'Organismes Rattachés', Icons.hub_outlined,
      Color(0xFF00796B)),
];

// ═══════════════════════════════════════════════════════════════
// ServicePicker widget
// ═══════════════════════════════════════════════════════════════

class ServicePicker extends ConsumerStatefulWidget {
  const ServicePicker({
    super.key,
    required this.onSelected,
    this.initialValue,
  });

  /// Called when the user reaches and taps a leaf node.
  final void Function(MinefopServiceNode service) onSelected;

  /// Pre-selected node — the picker will restore the path to it.
  final MinefopServiceNode? initialValue;

  @override
  ConsumerState<ServicePicker> createState() => _ServicePickerState();
}

class _ServicePickerState extends ConsumerState<ServicePicker> {
  // ── State ──────────────────────────────────────────────────

  String? _selectedCategory;
  bool _loading = false;
  String? _error;

  /// The currently selected (confirmed) leaf node.
  MinefopServiceNode? _selectedNode;

  /// Nodes displayed at the current drill-down level.
  List<MinefopServiceNode> _currentLevel = [];

  /// Breadcrumb stack — each entry is the node the user tapped to
  /// drill into. Empty = we are at root level.
  final List<MinefopServiceNode> _path = [];

  // ── Internal data structures (built once on load) ──────────

  /// All nodes in the flat list, keyed by code.
  final Map<String, MinefopServiceNode> _byCode = {};

  /// Children of each node, keyed by parent code.
  final Map<String, List<MinefopServiceNode>> _children = {};

  /// Root nodes (parentCode == null) for the loaded category.
  List<MinefopServiceNode> _roots = [];

  // ── Lifecycle ──────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    if (widget.initialValue != null) {
      _selectedCategory = widget.initialValue!.category;
      _loadCategory(_selectedCategory!).then((_) {
        if (mounted) _restorePath(widget.initialValue!);
      });
    }
  }

  // ── Network ────────────────────────────────────────────────

  Future<void> _loadCategory(String category) async {
    setState(() {
      _loading = true;
      _error = null;
      _currentLevel = [];
      _roots = [];
      _path.clear();
      _byCode.clear();
      _children.clear();
    });

    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get(
        '/minefop-services',
        queryParameters: {'category': category},
      );

      final flat = (resp.data as List)
          .map((j) => MinefopServiceNode.fromJson(j as Map<String, dynamic>))
          .toList();

      // Build lookup structures in a single pass.
      final roots = <MinefopServiceNode>[];
      for (final node in flat) {
        _byCode[node.code] = node;
        final parent = node.parentCode;
        if (parent == null) {
          roots.add(node);
        } else {
          _children.putIfAbsent(parent, () => []).add(node);
        }
      }

      // Sort everything alphabetically for consistent display.
      roots.sort((a, b) => a.displayName.compareTo(b.displayName));
      for (final list in _children.values) {
        list.sort((a, b) => a.displayName.compareTo(b.displayName));
      }

      if (mounted) {
        setState(() {
          _roots = roots;
          _currentLevel = roots;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Erreur de chargement : $e';
        });
      }
    }
  }

  // ── Path restoration ───────────────────────────────────────

  /// Rebuilds the breadcrumb path from the root to [target] so
  /// the picker opens at the correct level when an initialValue
  /// is provided. Works by walking up the parent-code chain.
  void _restorePath(MinefopServiceNode target) {
    final ancestorCodes = <String>[];
    var current = target;
    while (current.parentCode != null) {
      final parent = _byCode[current.parentCode!];
      if (parent == null) break;
      ancestorCodes.insert(0, parent.code);
      current = parent;
    }

    final newPath = ancestorCodes
        .map((code) => _byCode[code])
        .whereType<MinefopServiceNode>()
        .toList();

    setState(() {
      _path
        ..clear()
        ..addAll(newPath);
      _selectedNode = target;
      _currentLevel =
          newPath.isEmpty ? _roots : (_children[newPath.last.code] ?? []);
    });
  }

  // ── Interaction ────────────────────────────────────────────

  void _onNodeTap(MinefopServiceNode node) {
    final kids = _children[node.code] ?? [];
    if (kids.isEmpty) {
      // Leaf — confirm selection.
      setState(() => _selectedNode = node);
      widget.onSelected(node);
    } else {
      // Branch — drill down.
      setState(() {
        _path.add(node);
        _currentLevel = kids;
      });
    }
  }

  /// Navigate up to [index] in the breadcrumb path.
  /// Index -1 = go all the way back to root.
  void _navigateTo(int index) {
    if (index < -1 || index >= _path.length) return;
    setState(() {
      if (index == -1) {
        _path.clear();
        _currentLevel = _roots;
      } else {
        _path.removeRange(index + 1, _path.length);
        _currentLevel = _children[_path[index].code] ?? [];
      }
    });
  }

  // ── Build ──────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Category dropdown ───────────────────────────────
        _CategoryPicker(
          selected: _selectedCategory,
          onChanged: (cat) {
            setState(() {
              _selectedCategory = cat;
              _selectedNode = null;
            });
            _loadCategory(cat);
          },
        ),

        const SizedBox(height: 16),

        // ── Tree area ───────────────────────────────────────
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            transitionBuilder: (child, anim) => FadeTransition(
              opacity: anim,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.04, 0),
                  end: Offset.zero,
                ).animate(anim),
                child: child,
              ),
            ),
            child: _buildTreeArea(),
          ),
        ),

        // ── Selected confirmation chip ──────────────────────
        if (_selectedNode != null) ...[
          const SizedBox(height: 12),
          _SelectedChip(node: _selectedNode!),
        ],
      ],
    );
  }

  Widget _buildTreeArea() {
    // No category picked yet.
    if (_selectedCategory == null) {
      return const _EmptyState(
        key: ValueKey('no-cat'),
        icon: Icons.account_tree_outlined,
        message: 'Sélectionnez un type de service ci-dessus.',
      );
    }

    // Loading.
    if (_loading) {
      return const _LoadingState(key: ValueKey('loading'));
    }

    // Error.
    if (_error != null) {
      return _ErrorState(
        key: const ValueKey('error'),
        message: _error!,
        onRetry: () => _loadCategory(_selectedCategory!),
      );
    }

    // Empty result.
    if (_currentLevel.isEmpty) {
      return const _EmptyState(
        key: ValueKey('empty'),
        icon: Icons.inbox_outlined,
        message: 'Aucun service trouvé.',
      );
    }

    // Tree list.
    return Column(
      key: ValueKey('list-${_path.length}'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Breadcrumb
        if (_path.isNotEmpty || _selectedCategory != null)
          _Breadcrumb(
            category: _selectedCategory,
            path: _path,
            onNavigate: _navigateTo,
          ),

        const SizedBox(height: 8),

        // Node list
        Expanded(
          child: ListView.separated(
            itemCount: _currentLevel.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (ctx, i) {
              final node = _currentLevel[i];
              // A node has children if it appears as a key in _children
              // OR if the backend flagged hasChildren on the node itself.
              final hasKids = (_children[node.code]?.isNotEmpty ?? false) ||
                  node.hasChildren;
              final selected = node == _selectedNode;

              return _NodeTile(
                node: node,
                hasKids: hasKids,
                isSelected: selected,
                onTap: () => _onNodeTap(node),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Sub-widgets
// ═══════════════════════════════════════════════════════════════

// ── Category picker ──────────────────────────────────────────

class _CategoryPicker extends StatelessWidget {
  const _CategoryPicker({
    required this.selected,
    required this.onChanged,
  });

  final String? selected;
  final void Function(String) onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Type de service *',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: UltraTheme.textSecondary,
            )),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            border:
                Border.all(color: UltraTheme.primary.withValues(alpha: 0.25)),
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selected,
              isExpanded: true,
              hint: const Text('Sélectionner un type de service',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: UltraTheme.textMuted)),
              items: _categories
                  .map((c) => DropdownMenuItem(
                        value: c.value,
                        child: Row(children: [
                          Icon(c.icon, size: 16, color: c.color),
                          const SizedBox(width: 10),
                          Text(c.label,
                              style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 14,
                                  color: UltraTheme.textPrimary)),
                        ]),
                      ))
                  .toList(),
              onChanged: (v) {
                if (v != null) onChanged(v);
              },
            ),
          ),
        ),
      ],
    );
  }
}

// ── Breadcrumb ───────────────────────────────────────────────

class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({
    required this.category,
    required this.path,
    required this.onNavigate,
  });

  final String? category;
  final List<MinefopServiceNode> path;
  final void Function(int index) onNavigate; // -1 = root

  @override
  Widget build(BuildContext context) {
    final cat = _categories.firstWhere(
      (c) => c.value == category,
      orElse: () => _categories.first,
    );

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        // Root chip
        _BreadcrumbChip(
          label: cat.shortName,
          icon: cat.icon,
          color: cat.color,
          isLast: path.isEmpty,
          onTap: path.isEmpty ? null : () => onNavigate(-1),
        ),
        // Path chips
        for (int i = 0; i < path.length; i++) ...[
          const Icon(Icons.chevron_right,
              size: 16, color: UltraTheme.textMuted),
          _BreadcrumbChip(
            label: path[i].shortName,
            isLast: i == path.length - 1,
            onTap: i == path.length - 1 ? null : () => onNavigate(i),
          ),
        ],
      ]),
    );
  }
}

class _BreadcrumbChip extends StatelessWidget {
  const _BreadcrumbChip({
    required this.label,
    this.icon,
    this.color,
    required this.isLast,
    this.onTap,
  });

  final String label;
  final IconData? icon;
  final Color? color;
  final bool isLast;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final fg = isLast ? UltraTheme.primary : UltraTheme.textMuted;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isLast
              ? UltraTheme.primary.withValues(alpha: 0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color ?? fg),
            const SizedBox(width: 5),
          ],
          Text(label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: isLast ? FontWeight.w600 : FontWeight.w500,
                color: fg,
              )),
        ]),
      ),
    );
  }
}

// ── Node tile ────────────────────────────────────────────────

class _NodeTile extends StatelessWidget {
  const _NodeTile({
    required this.node,
    required this.hasKids,
    required this.isSelected,
    required this.onTap,
  });

  final MinefopServiceNode node;
  final bool hasKids;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected
          ? UltraTheme.primary.withValues(alpha: 0.06)
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        splashColor: UltraTheme.primary.withValues(alpha: 0.05),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(children: [
            // Icon
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isSelected
                    ? UltraTheme.primary.withValues(alpha: 0.12)
                    : UltraTheme.background,
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              ),
              child: Icon(
                hasKids ? Icons.folder_outlined : Icons.apartment_outlined,
                size: 18,
                color: isSelected ? UltraTheme.primary : UltraTheme.textMuted,
              ),
            ),
            const SizedBox(width: 12),

            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    node.displayName,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w500,
                      color: isSelected
                          ? UltraTheme.primary
                          : UltraTheme.textPrimary,
                    ),
                  ),
                  if (node.nameEn != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      node.nameEn!,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: UltraTheme.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Trailing
            if (isSelected && !hasKids)
              const Icon(Icons.check_circle_rounded,
                  size: 18, color: UltraTheme.primary)
            else if (hasKids)
              const Icon(Icons.chevron_right,
                  size: 20, color: UltraTheme.textMuted),
          ]),
        ),
      ),
    );
  }
}

// ── Selected confirmation chip ───────────────────────────────

class _SelectedChip extends StatelessWidget {
  const _SelectedChip({required this.node});
  final MinefopServiceNode node;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: UltraTheme.success.withValues(alpha: 0.08),
        border: Border.all(color: UltraTheme.success.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
      ),
      child: Row(children: [
        const Icon(Icons.check_circle_outline_rounded,
            size: 18, color: UltraTheme.success),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Service sélectionné',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.success,
                  )),
              const SizedBox(height: 2),
              Text(node.displayName,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: UltraTheme.textPrimary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ]),
    );
  }
}

// ── Loading state ────────────────────────────────────────────

class _LoadingState extends StatelessWidget {
  const _LoadingState({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(5, (i) => _shimmer(i)),
    );
  }

  Widget _shimmer(int i) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: UltraTheme.background,
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          ),
          child: const LinearProgressIndicator(
            backgroundColor: Colors.transparent,
            valueColor: AlwaysStoppedAnimation<Color>(UltraTheme.primary),
          ),
        ),
      );
}

// ── Error state ──────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.wifi_off_rounded,
              size: 40, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          const Text('Impossible de charger les services',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary,
              )),
          const SizedBox(height: 6),
          Text(message,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: UltraTheme.textMuted),
              textAlign: TextAlign.center),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('Réessayer'),
            style: TextButton.styleFrom(foregroundColor: UltraTheme.primary),
          ),
        ]),
      ),
    );
  }
}

// ── Empty state ──────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({super.key, required this.icon, required this.message});
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 40, color: UltraTheme.textMuted),
        const SizedBox(height: 12),
        Text(message,
            style: const TextStyle(
                fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
            textAlign: TextAlign.center),
      ]),
    );
  }
}

// ── Convenience extension ────────────────────────────────────

extension on _Category {
  String get shortName {
    const abbrevs = {
      'DECONCENTRE': 'Déconcentré',
      'CENTRALE': 'Centrale',
      'RATTACHE': 'Rattaché',
    };
    return abbrevs[value] ?? label;
  }
}
