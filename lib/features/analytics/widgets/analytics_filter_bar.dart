// lib/features/analytics/widgets/analytics_filter_bar.dart
// Filter controls wired to your EXISTING providers.
//
// Import path: ../providers/dashboard_providers.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/dashboard_providers.dart';

class AnalyticsFilterBar extends ConsumerWidget {
  const AnalyticsFilterBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLocked = ref.watch(isScopeLockedProvider);
    final year = ref.watch(yearProvider);
    final region = ref.watch(regionIdProvider);
    final isMobile = Breakpoints.isMobile(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(bottom: BorderSide(color: AppColors.divider)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: isMobile
          ? _MobileLayout(year: year, region: region, isLocked: isLocked)
          : _DesktopLayout(year: year, region: region, isLocked: isLocked),
    );
  }
}

class _DesktopLayout extends ConsumerWidget {
  final int year;
  final String? region;
  final bool isLocked;
  const _DesktopLayout(
      {required this.year, required this.region, required this.isLocked});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        Flexible(child: _YearPicker(year: year)),
        const SizedBox(width: 12),
        if (!isLocked) ...[
          Flexible(child: _RegionPicker()),
          const SizedBox(width: 12),
          Flexible(child: _DepartmentPicker()),
          const SizedBox(width: 12),
        ],
        if (isLocked) _ScopeLockedChip(),
        const Spacer(),
        _ActiveFilterChips(),
        const SizedBox(width: 12),
        _ExportButton(),
      ],
    );
  }
}

class _MobileLayout extends ConsumerWidget {
  final int year;
  final String? region;
  final bool isLocked;
  const _MobileLayout(
      {required this.year, required this.region, required this.isLocked});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _YearPicker(year: year)),
            const SizedBox(width: 8),
            if (!isLocked) _FilterMenuButton() else _ScopeLockedChip(),
          ],
        ),
        if (!isLocked && _hasActiveFilters(ref)) ...[
          const SizedBox(height: 8),
          _ActiveFilterChips(),
        ],
      ],
    );
  }
}

// ── Year picker ──

class _YearPicker extends ConsumerWidget {
  final int year;
  const _YearPicker({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _FilterDropdown<int>(
      label: 'Année',
      value: year,
      items: List.generate(5, (i) {
        final y = DateTime.now().year - i;
        return DropdownMenuItem(value: y, child: Text('$y'));
      }),
      onChanged: (v) {
        if (v != null) ref.read(yearProvider.notifier).state = v;
      },
    );
  }
}

// ── Region picker (national users only) ──

class _RegionPicker extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final regionsAsync = ref.watch(regionsProvider);
    final selected = ref.watch(regionIdProvider);

    return regionsAsync.when(
      data: (regions) {
        final items = [
          const DropdownMenuItem<String?>(
              value: null, child: Text('Toutes les régions')),
          ...regions.map((r) => DropdownMenuItem<String?>(
                value: r['id']?.toString() ?? r['code']?.toString(),
                child: Text(r['name']?.toString() ?? 'Inconnu'),
              )),
        ];
        return _FilterDropdown<String?>(
          label: 'Région',
          value: selected,
          items: items,
          onChanged: (v) {
            ref.read(regionIdProvider.notifier).state = v;
            ref.read(departmentIdProvider.notifier).state = null;
          },
        );
      },
      loading: () => _FilterDropdown<String?>(
          label: 'Région', value: selected, items: const [], onChanged: (_) {}),
      error: (_, __) => _FilterDropdown<String?>(
          label: 'Région', value: selected, items: const [], onChanged: (_) {}),
    );
  }
}

// ── Department picker (when region selected) ──

class _DepartmentPicker extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final region = ref.watch(regionIdProvider);
    final selected = ref.watch(departmentIdProvider);

    if (region == null) {
      return _FilterDropdown<String?>(
        label: 'Département',
        value: null,
        hint: 'Sélectionnez une région',
        items: const [],
        onChanged: (_) {},
      );
    }

    final deptsAsync = ref.watch(departmentsProvider(region));
    return deptsAsync.when(
      data: (depts) {
        final items = [
          const DropdownMenuItem<String?>(
              value: null, child: Text('Tous les départements')),
          ...depts.map((d) => DropdownMenuItem<String?>(
                value: d['id']?.toString() ?? d['code']?.toString(),
                child: Text(d['name']?.toString() ?? 'Inconnu'),
              )),
        ];
        return _FilterDropdown<String?>(
          label: 'Département',
          value: selected,
          items: items,
          onChanged: (v) => ref.read(departmentIdProvider.notifier).state = v,
        );
      },
      loading: () => _FilterDropdown<String?>(
          label: 'Département',
          value: selected,
          items: const [],
          onChanged: (_) {}),
      error: (_, __) => _FilterDropdown<String?>(
          label: 'Département',
          value: selected,
          items: const [],
          onChanged: (_) {}),
    );
  }
}

// ── Scope locked indicator ──

class _ScopeLockedChip extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scope = ref.watch(userScopeProvider);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.warning.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.warning.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.lock_outline, size: 14, color: AppColors.warning),
          const SizedBox(width: 6),
          Text(
            scope.region != null
                ? 'Scope: ${scope.region}'
                : 'Scope verrouillé',
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.warning),
          ),
        ],
      ),
    );
  }
}

// ── Generic dropdown wrapper ──

class _FilterDropdown<T> extends StatelessWidget {
  final String label;
  final T? value;
  final String? hint;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  const _FilterDropdown({
    required this.label,
    required this.value,
    this.hint,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 120, maxWidth: 220),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.divider),
        borderRadius: BorderRadius.circular(8),
        color: AppColors.background,
      ),
      child: Row(
        children: [
          Text(
            '$label: ',
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<T>(
                isExpanded: true, // ← forces fill + ellipsis
                value: value,
                hint: hint != null
                    ? Text(
                        hint!,
                        overflow: TextOverflow.ellipsis, // ← safety
                        style: const TextStyle(color: AppColors.textMuted),
                      )
                    : null,
                items: items,
                onChanged: onChanged,
                style: Theme.of(context)
                    .textTheme
                    .bodyLarge
                    ?.copyWith(fontWeight: FontWeight.w600),
                icon: const Icon(Icons.keyboard_arrow_down, size: 18),
                dropdownColor: AppColors.surface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
// ── Mobile filter menu ──

class _FilterMenuButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      icon: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8)),
        child: Badge(
          isLabelVisible: _hasActiveFilters(ref),
          child: const Icon(Icons.filter_list, color: AppColors.primary),
        ),
      ),
      itemBuilder: (_) => [
        const PopupMenuItem(value: 'region', child: Text('Filtrer par région')),
        const PopupMenuItem(
            value: 'dept', child: Text('Filtrer par département')),
        const PopupMenuDivider(),
        const PopupMenuItem(value: 'clear', child: Text('Réinitialiser')),
      ],
      onSelected: (v) {
        if (v == 'clear') {
          ref.read(regionIdProvider.notifier).state = null;
          ref.read(departmentIdProvider.notifier).state = null;
        }
      },
    );
  }
}

// ── Active filter chips ──

class _ActiveFilterChips extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final region = ref.watch(regionIdProvider);
    final dept = ref.watch(departmentIdProvider);
    final regionName = ref.watch(regionNameProvider);
    final chips = <Widget>[];

    if (region != null) {
      chips.add(_FilterChip(
        label: regionName ?? 'Région: $region',
        onRemove: () {
          ref.read(regionIdProvider.notifier).state = null;
          ref.read(departmentIdProvider.notifier).state = null;
        },
      ));
    }
    if (dept != null) {
      chips.add(_FilterChip(
        label: 'Dépt: $dept',
        onRemove: () => ref.read(departmentIdProvider.notifier).state = null,
      ));
    }

    if (chips.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;
  const _FilterChip({required this.label, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
      deleteIcon: const Icon(Icons.close, size: 16),
      onDeleted: onRemove,
      backgroundColor: AppColors.primary.withOpacity(0.08),
      side: BorderSide(color: AppColors.primary.withOpacity(0.2)),
    );
  }
}

// ── Export button placeholder ──

class _ExportButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Export en cours de développement')),
        );
      },
      icon: const Icon(Icons.download, size: 18),
      label: const Text('Exporter'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.divider),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      ),
    );
  }
}

bool _hasActiveFilters(WidgetRef ref) {
  return ref.read(regionIdProvider) != null ||
      ref.read(departmentIdProvider) != null;
}
