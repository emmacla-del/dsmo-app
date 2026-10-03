import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'providers.dart';

class CameroonDepartment {
  final String id;
  final String name;
  final List<String> subdivisions;
  const CameroonDepartment({
    this.id = '',
    required this.name,
    required this.subdivisions,
  });

  factory CameroonDepartment.fromJson(Map<String, dynamic> json) {
    final rawSubs = json['subdivisions'] as List? ?? [];
    final subs = rawSubs.map((s) {
      if (s is Map) {
        return (s['name'] ?? '').toString();
      }
      return s.toString();
    }).where((s) => s.isNotEmpty).toList();

    return CameroonDepartment(
      id: (json['id'] ?? json['code'] ?? json['name'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      subdivisions: subs,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'subdivisions': subdivisions,
  };
}

class CameroonRegion {
  final String id;
  final String name;
  final List<CameroonDepartment> departments;
  const CameroonRegion({
    this.id = '',
    required this.name,
    required this.departments,
  });

  factory CameroonRegion.fromJson(Map<String, dynamic> json) {
    final rawDepts = json['departments'] as List? ?? [];
    return CameroonRegion(
      id: (json['id'] ?? json['code'] ?? json['name'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      departments: rawDepts
          .map((d) => CameroonDepartment.fromJson(Map<String, dynamic>.from(d as Map)))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'departments': departments.map((d) => d.toJson()).toList(),
  };
}

const String _kLocationStructurePrefsKey = 'cached_location_structure_json';

/// In-memory cache holding the last resolved structure across widget rebuilds
List<CameroonRegion>? _memoryLocationCache;

/// Helper to get current synchronous cache or empty list
List<CameroonRegion> getCachedLocationStructure() {
  return _memoryLocationCache ?? const [];
}

/// Helper to set the synchronous memory cache (useful for tests and initialization)
void setCachedLocationStructure(List<CameroonRegion> list) {
  _memoryLocationCache = list;
}

/// Helper to find a region in a tree
CameroonRegion? findCameroonRegionInTree(List<CameroonRegion> tree, String? name) {
  if (name == null || name.trim().isEmpty) return null;
  final clean = name.trim().toLowerCase();
  for (final r in tree) {
    if (r.name.toLowerCase() == clean) return r;
  }
  return null;
}

/// Helper to find a department in a tree
CameroonDepartment? findCameroonDepartmentInTree(
  List<CameroonRegion> tree,
  String? deptName, {
  String? regionName,
}) {
  if (deptName == null || deptName.trim().isEmpty) return null;
  final cleanDept = deptName.trim().toLowerCase();
  final region = findCameroonRegionInTree(tree, regionName);
  final regionsToSearch = region != null ? [region] : tree;
  for (final r in regionsToSearch) {
    for (final d in r.departments) {
      if (d.name.toLowerCase() == cleanDept) return d;
    }
  }
  return null;
}

CameroonRegion? findCameroonRegion(String? name) {
  return findCameroonRegionInTree(_memoryLocationCache ?? const [], name);
}

CameroonDepartment? findCameroonDepartment(String? deptName, {String? regionName}) {
  return findCameroonDepartmentInTree(_memoryLocationCache ?? const [], deptName, regionName: regionName);
}

final locationStructureProvider = FutureProvider<List<CameroonRegion>>((ref) async {
  if (_memoryLocationCache != null && _memoryLocationCache!.isNotEmpty) {
    return _memoryLocationCache!;
  }

  final api = ref.read(apiClientProvider);

  try {
    final rawList = await api.getLocationStructure();
    final regions = rawList
        .map((r) => CameroonRegion.fromJson(Map<String, dynamic>.from(r as Map)))
        .toList();

    _memoryLocationCache = regions;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kLocationStructurePrefsKey, jsonEncode(regions.map((r) => r.toJson()).toList()));
    } catch (_) {
      // Best-effort cache persistence
    }
    return regions;
  } catch (e) {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString(_kLocationStructurePrefsKey);
      if (cached != null && cached.isNotEmpty) {
        final decoded = jsonDecode(cached) as List;
        final regions = decoded
            .map((r) => CameroonRegion.fromJson(Map<String, dynamic>.from(r as Map)))
            .toList();
        _memoryLocationCache = regions;
        return regions;
      }
    } catch (_) {
      // Ignore cache read errors
    }
    return _memoryLocationCache ?? const [];
  }
});

final locationRegionsProvider = Provider<List<String>>((ref) {
  final asyncVal = ref.watch(locationStructureProvider);
  return asyncVal.maybeWhen(
    data: (regions) => regions.map((r) => r.name).toList(),
    orElse: () => _memoryLocationCache?.map((r) => r.name).toList() ?? const [],
  );
});

final locationDepartmentsProvider = Provider.family<List<String>, String?>((ref, regionName) {
  final asyncVal = ref.watch(locationStructureProvider);
  final tree = asyncVal.maybeWhen(
    data: (regions) => regions,
    orElse: () => _memoryLocationCache ?? const [],
  );
  if (regionName == null || regionName.trim().isEmpty) {
    return tree.expand((r) => r.departments.map((d) => d.name)).toList();
  }
  final reg = findCameroonRegionInTree(tree, regionName);
  return reg?.departments.map((d) => d.name).toList() ?? const [];
});
