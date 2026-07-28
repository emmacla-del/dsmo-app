// lib/features/analytics/widgets/location_filter_dialog.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/geo_provider.dart';

Future<(String? region, String? department, String? subdivision)?>
    showLocationFilterDialog(
  BuildContext context,
  WidgetRef ref, {
  String? initialRegion,
  String? initialDepartment,
  String? initialSubdivision,
}) async {
  // Pre-fetch the structure
  await ref.read(geoStructureProvider.future);

  if (!context.mounted) return null;

  String? tempRegion = initialRegion;
  String? tempDepartment = initialDepartment;
  String? tempSubdivision = initialSubdivision;

  return showDialog(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (ctx, setDialogState) => Consumer(
        builder: (ctx, ref, _) {
          final regionNames = ref.watch(regionNamesProvider);
          final departments =
              ref.watch(departmentsByRegionProvider(tempRegion));
          // Fix: Pass the correct record parameter
          final subdivisions = ref.watch(subdivisionsByDeptProvider(
              (region: tempRegion, department: tempDepartment)));

          return AlertDialog(
            title: const Text('Filtres géographiques'),
            content: SizedBox(
              width: 320,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Region dropdown
                  DropdownButtonFormField<String?>(
                    value: tempRegion,
                    decoration: const InputDecoration(labelText: 'Région'),
                    items: [
                      const DropdownMenuItem(
                          value: null, child: Text('Toutes les régions')),
                      ...regionNames.map(
                          (r) => DropdownMenuItem(value: r, child: Text(r))),
                    ],
                    onChanged: (v) {
                      setDialogState(() {
                        tempRegion = v;
                        tempDepartment = null;
                        tempSubdivision = null;
                      });
                    },
                  ),
                  if (tempRegion != null && departments.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      value: tempDepartment,
                      decoration:
                          const InputDecoration(labelText: 'Département'),
                      items: [
                        const DropdownMenuItem(
                            value: null, child: Text('Tous les départements')),
                        ...departments.map(
                            (d) => DropdownMenuItem(value: d, child: Text(d))),
                      ],
                      onChanged: (v) {
                        setDialogState(() {
                          tempDepartment = v;
                          tempSubdivision = null;
                        });
                      },
                    ),
                  ],
                  if (tempDepartment != null && subdivisions.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      value: tempSubdivision,
                      decoration:
                          const InputDecoration(labelText: 'Arrondissement'),
                      items: [
                        const DropdownMenuItem(
                            value: null,
                            child: Text('Tous les arrondissements')),
                        ...subdivisions.map(
                            (s) => DropdownMenuItem(value: s, child: Text(s))),
                      ],
                      onChanged: (v) =>
                          setDialogState(() => tempSubdivision = v),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Annuler'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(
                    ctx, (tempRegion, tempDepartment, tempSubdivision)),
                child: const Text('Appliquer'),
              ),
            ],
          );
        },
      ),
    ),
  );
}
