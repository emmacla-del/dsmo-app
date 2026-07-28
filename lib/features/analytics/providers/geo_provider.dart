// lib/features/analytics/providers/geo_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';

// Fetch full location structure once
final geoStructureProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiClientProvider);
  final structure = await api.getLocationStructure();
  return structure.map((e) => Map<String, dynamic>.from(e)).toList();
});

// Derived providers for reactive filtering
final regionNamesProvider = Provider<List<String>>((ref) {
  final geoAsync = ref.watch(geoStructureProvider);
  return geoAsync.maybeWhen(
    data: (geo) => geo.map((r) => r['name'] as String).toList(),
    orElse: () => [],
  );
});

final departmentsByRegionProvider =
    Provider.family<List<String>, String?>((ref, regionName) {
  if (regionName == null) return [];
  final geoAsync = ref.watch(geoStructureProvider);
  return geoAsync.maybeWhen(
    data: (geo) {
      final region = geo.firstWhere(
        (r) => r['name'] == regionName,
        orElse: () => {},
      );
      if (region.isEmpty) return [];
      return (region['departments'] as List<dynamic>)
          .map((d) => d['name'] as String)
          .toList();
    },
    orElse: () => [],
  );
});

final subdivisionsByDeptProvider =
    Provider.family<List<String>, ({String? region, String? department})>(
        (ref, params) {
  if (params.region == null || params.department == null) return [];
  final geoAsync = ref.watch(geoStructureProvider);
  return geoAsync.maybeWhen(
    data: (geo) {
      final region = geo.firstWhere(
        (r) => r['name'] == params.region,
        orElse: () => {},
      );
      if (region.isEmpty) return [];
      final depts = region['departments'];
      if (depts is! List) return [];
      final dept = depts.whereType<Map>().firstWhere(
            (d) => d['name'] == params.department,
            orElse: () => {},
          );
      if (dept.isEmpty) return [];
      final subs = dept['subdivisions'];
      if (subs is! List) return [];
      // Each subdivision is {id, name} (see LocationsService.getFullStructure),
      // not a bare string — whereType<String>() would always yield [].
      return subs
          .whereType<Map>()
          .map((s) => s['name'] as String)
          .toList();
    },
    orElse: () => [],
  );
});
